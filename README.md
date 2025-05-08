# 分布式文件服务节点实施文档

## 目录

1. [系统概述](#系统概述)
2. [架构设计](#架构设计)
3. [实现细节](#实现细节)
4. [部署指南](#部署指南)
5. [API参考](#api参考)
6. [故障排除](#故障排除)
7. [性能优化](#性能优化)

## 系统概述

分布式文件服务节点是无纸化会议系统的重要组成部分，用于分担主控服务器的文件下载负载。通过将文件下载任务分散到多个分布式节点，系统可以提高整体性能和可用性，同时降低主控服务器的负载。

### 主要功能

- 自动从主控服务器同步会议数据
- 提供与主控服务器兼容的文件下载API
- 自动向主控服务器注册和注销
- 定期检查会议状态并更新本地文件
- 提供健康检查API用于监控节点状态

### 工作原理

分布式文件服务节点通过以下方式工作：

1. 节点启动时向主控服务器注册
2. 定期轮询主控服务器获取会议状态
3. 当检测到有活动会议时，从主控服务器同步会议文件
4. 提供与主控服务器兼容的下载API
5. 当前端请求下载文件时，主控服务器将请求重定向到分布式节点
6. 分布式节点直接向前端提供文件下载服务

## 架构设计

### 系统组件

```
┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │
│  主控服务器     │◄────►│  分布式节点1    │
│                 │      │                 │
└───────┬─────────┘      └─────────────────┘
        │
        │               ┌─────────────────┐
        │               │                 │
        └──────────────►│  分布式节点2    │
                        │                 │
                        └─────────────────┘
```

### 数据流

```
┌─────────┐     1. 状态轮询     ┌─────────────┐
│  前端   │ -----------------> │ 主控服务器  │
│ 客户端  │ <----------------- │             │
└─────────┘     2. 返回状态     └──────┬──────┘
     │                                 │
     │                                 │ 5. 同步会议文件
     │                                 │
     │                                 ▼
     │ 3. 获取会议数据         ┌─────────────┐
     └ ----------------------> │ 主控服务器  │
       <---------------------- │             │
         4. 返回数据           └──────┬──────┘
                                      │
     ┌─────────────────────────┐      │
     │                         │      │
     │ 6. 请求下载文件         │      │
     ▼                         │      │
┌─────────┐                    │    ┌─┴───────────┐
│  前端   │ -------------------┴--> │ 主控服务器  │
│ 客户端  │ <---------------------- │             │
└─────────┘    7. 重定向到节点      └─────────────┘
     │
     │ 8. 跟随重定向
     ▼
┌─────────────┐
│ 分布式节点  │
│             │
└─────────────┘
     │
     │ 9. 返回文件数据
     ▼
┌─────────┐
│  前端   │
│ 客户端  │
└─────────┘
```

### 关键技术

- **FastAPI**：用于构建高性能的异步API
- **异步编程**：使用`asyncio`和`aiohttp`实现高效的网络操作
- **HTTP重定向**：主控服务器通过HTTP重定向将下载请求转发到分布式节点
- **健康检查**：定期检查节点状态，确保系统可靠性

## 实现细节

### 文件结构

```
tongbuhouduan/
├── main.py              # 主程序入口
├── start.py             # 启动脚本
├── requirements.txt     # 依赖项列表
├── README.md            # 文档
└── storage/             # 存储目录
    ├── meeting_files/   # 会议文件存储
    └── download/        # 下载临时目录
```

### 核心组件

1. **节点管理**：负责向主控服务器注册和注销节点
2. **会议同步**：定期从主控服务器同步会议数据
3. **文件服务**：提供文件下载API
4. **健康检查**：提供节点状态监控

### 关键代码

#### 节点注册

```python
async def register_node():
    """向主控服务器注册节点"""
    try:
        session = await get_http_session()
        node_info = {
            "node_id": NODE_ID,
            "address": os.getenv("NODE_ADDRESS", "localhost:8001"),
            "status": "online"
        }
        async with session.post(f"{MAIN_SERVER_URL}/api/v1/nodes/register", json=node_info) as response:
            if response.status == 200:
                logger.info("节点注册成功")
                return True
            else:
                logger.error(f"节点注册失败: HTTP {response.status}")
                return False
    except Exception as e:
        logger.error(f"节点注册出错: {str(e)}")
        return False
```

#### 会议同步

```python
async def sync_meeting_data(meeting_id):
    """同步指定会议的数据"""
    try:
        logger.info(f"开始同步会议数据: {meeting_id}")

        # 创建会议目录
        meeting_dir = os.path.join(STORAGE_PATH, "meeting_files", meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)

        # 获取会议包
        package_path = os.path.join(meeting_dir, "package.zip")

        # 从主控服务器下载会议包
        session = await get_http_session()
        async with session.get(f"{MAIN_SERVER_URL}/api/v1/meetings/{meeting_id}/download-package-direct") as response:
            if response.status == 200:
                # 读取响应内容
                content = await response.read()

                # 保存到文件
                with open(package_path, "wb") as f:
                    f.write(content)

                logger.info(f"会议 {meeting_id} 同步完成，包大小: {len(content)} 字节")
                return True
            else:
                logger.error(f"下载会议包失败: HTTP {response.status}")
                return False
    except Exception as e:
        logger.error(f"同步会议数据出错: {str(e)}")
        return False
```

#### 文件下载API

```python
@app.get("/api/v1/meetings/{meeting_id}/download-package")
async def download_meeting_package(meeting_id: str):
    """提供会议包下载，与主控服务器API兼容"""
    # 构建本地存储路径
    package_path = os.path.join(STORAGE_PATH, "meeting_files", meeting_id, "package.zip")

    # 检查会议包是否存在
    if not os.path.exists(package_path):
        # 如果本地没有，尝试从主控服务器同步
        synced = await sync_meeting_data(meeting_id)
        if not synced or not os.path.exists(package_path):
            raise HTTPException(status_code=404, detail="Meeting package not found")

    # 提供文件下载
    return FileResponse(
        path=package_path,
        filename=f"meeting_{meeting_id}.zip",
        media_type="application/zip"
    )
```

## 部署指南

### 环境要求

- Python 3.7+
- 网络连接到主控服务器
- 足够的存储空间用于会议文件

### 安装依赖

```bash
pip install -r requirements.txt
```

### 配置选项

分布式节点支持以下配置选项，可以通过环境变量或命令行参数设置：

| 选项 | 环境变量 | 命令行参数 | 默认值 | 说明 |
|------|----------|------------|--------|------|
| 主控服务器URL | MAIN_SERVER_URL | --main-server | http://127.0.0.1:8000 | 主控服务器的URL |
| 节点对外地址 | NODE_ADDRESS | --node-address | localhost:8001 | 节点的对外访问地址 |
| 存储路径 | STORAGE_PATH | --storage-path | ./storage | 文件存储路径 |
| 同步间隔 | SYNC_INTERVAL | --sync-interval | 300 | 同步间隔(秒) |
| 节点ID | NODE_ID | --node-id | 自动生成 | 节点的唯一标识 |
| 监听主机 | - | --host | 0.0.0.0 | 监听的主机地址 |
| 监听端口 | - | --port | 8001 | 监听的端口 |

### 启动服务

使用启动脚本启动服务：

```bash
python start.py --host 0.0.0.0 --port 8001 --main-server http://主控服务器IP:8000 --node-address 节点IP:8001
```

### 验证部署

1. 检查节点是否已在主控服务器注册：
   ```
   curl http://主控服务器IP:8000/api/v1/nodes/list
   ```

## API参考

### 文件下载

```
GET /api/v1/meetings/{meeting_id}/download-package
```

下载指定会议的文件包。

**参数**：
- `meeting_id`：会议ID

**响应**：
- 成功：返回文件内容，Content-Type为application/zip
- 失败：返回404错误

## 故障排除

### 常见问题

1. **节点无法连接到主控服务器**
   - 检查主控服务器URL是否正确
   - 确认网络连接是否正常
   - 检查主控服务器是否在运行

2. **文件同步失败**
   - 检查主控服务器的下载API是否可用
   - 确认存储目录是否有写入权限
   - 检查磁盘空间是否充足

3. **下载请求返回404**
   - 确认会议ID是否正确
   - 检查会议文件是否已同步
   - 查看日志了解详细错误信息

### 日志分析

日志记录了节点的运行状态和错误信息，可以通过分析日志来排查问题：

```
2025-04-27 10:15:30 - file_node - INFO - 文件服务节点已启动 [ID: node-1234]
2025-04-27 10:15:31 - file_node - INFO - 节点注册成功
2025-04-27 10:15:32 - file_node - INFO - 开始同步会议数据...
2025-04-27 10:15:33 - file_node - INFO - 当前没有活动会议
```

## 性能优化

### 优化建议

1. **增加缓存**：
   - 缓存会议状态查询结果
   - 使用内存缓存减少磁盘I/O

2. **调整同步策略**：
   - 根据系统负载调整同步间隔
   - 实现增量同步减少数据传输

3. **网络优化**：
   - 使用HTTP/2减少连接开销
   - 实现请求合并减少网络往返

4. **存储优化**：
   - 定期清理过期文件
   - 实现文件压缩减少存储空间

### 扩展建议

1. **多节点部署**：
   - 在不同地理位置部署多个节点
   - 实现基于地理位置的智能路由

2. **负载均衡**：
   - 实现更复杂的负载均衡算法
   - 考虑节点负载和网络状况

3. **监控系统**：
   - 实现详细的性能监控
   - 设置自动告警机制

4. **安全加固**：
   - 实现节点认证机制
   - 加密传输数据
   - 实现访问控制
