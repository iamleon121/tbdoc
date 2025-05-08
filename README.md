# 分布式文件服务节点实施文档

## 目录

1. [系统概述](#系统概述)
2. [架构设计](#架构设计)
3. [实现细节](#实现细节)
4. [配置管理](#配置管理)
5. [部署指南](#部署指南)
6. [API参考](#api参考)
7. [故障排除](#故障排除)
8. [性能优化](#性能优化)

## 系统概述

分布式文件服务节点是无纸化会议系统的重要组成部分，用于分担主控服务器的文件下载负载。通过将文件下载任务分散到多个分布式节点，系统可以提高整体性能和可用性，同时降低主控服务器的负载。

### 主要功能

- 自动从主控服务器同步会议数据
- 提供与主控服务器兼容的文件下载API
- 自动向主控服务器注册和注销
- 定期发送心跳和同步会议文件
- 提供Web管理界面用于配置和监控节点
- 自动清理非活动会议文件

### 工作原理

分布式文件服务节点通过以下方式工作：

1. 节点启动时向主控服务器注册，提供节点ID和地址信息
2. 定期向主控服务器发送心跳，报告节点状态和已同步的会议
3. 定期轮询主控服务器获取活动会议状态
4. 当检测到有活动会议时，从主控服务器同步会议文件包
5. 提供与主控服务器兼容的下载API
6. 当前端请求下载文件时，主控服务器将请求重定向到分布式节点
7. 分布式节点直接向前端提供文件下载服务
8. 节点会自动清理非活动会议的文件，释放存储空间

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

### 节点内部架构

```
┌───────────────────────────────────────────────┐
│                分布式文件服务节点              │
│                                               │
│  ┌─────────────┐        ┌──────────────────┐  │
│  │             │        │                  │  │
│  │  配置管理   │◄──────►│  主程序(main.py) │  │
│  │ (config.py) │        │                  │  │
│  │             │        │                  │  │
│  └─────────────┘        └───────┬──────────┘  │
│                                 │             │
│                                 ▼             │
│  ┌─────────────┐        ┌──────────────────┐  │
│  │             │        │                  │  │
│  │  启动脚本   │───────►│   存储管理       │  │
│  │ (start.py)  │        │                  │  │
│  │             │        │                  │  │
│  └─────────────┘        └──────────────────┘  │
│                                               │
└───────────────────────────────────────────────┘
```

### 关键技术

- **FastAPI**：用于构建高性能的异步API
- **异步编程**：使用`asyncio`和`aiohttp`实现高效的网络操作
- **HTTP重定向**：主控服务器通过HTTP重定向将下载请求转发到分布式节点
- **心跳机制**：定期向主控服务器发送心跳，报告节点状态
- **配置管理**：通过JSON配置文件和Web界面管理节点配置
- **自动清理**：自动清理非活动会议文件，优化存储空间

## 实现细节

### 文件结构

```
tongbuhouduan/
├── main.py              # 主程序入口
├── config.py            # 配置管理模块
├── start.py             # 启动脚本
├── node_config.json     # 配置文件
├── requirements.txt     # 依赖项列表
├── README.md            # 文档
├── static/              # Web界面静态文件
│   └── index.html       # 控制面板页面
└── storage/             # 存储目录
    └── meeting_{id}/    # 会议文件存储目录
        └── package.zip  # 会议文件包
```

### 核心组件

1. **配置管理**：负责加载和保存节点配置
2. **节点管理**：负责向主控服务器注册和注销节点
3. **心跳服务**：定期向主控服务器发送心跳
4. **会议同步**：定期从主控服务器同步会议数据
5. **文件服务**：提供文件下载API
6. **状态监控**：提供节点状态查询API
7. **Web界面**：提供节点配置和监控界面

### 关键代码

#### 配置管理

```python
def load_config():
    """从配置文件加载配置"""
    config = DEFAULT_CONFIG.copy()

    # 生成默认节点ID
    if not config.get("nodeId"):
        config["nodeId"] = f"node-{uuid.uuid4().hex[:8]}"

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                loaded_config = json.load(f)
                logger.info(f"配置已从 {CONFIG_FILE} 加载")

                # 递归合并配置
                merge_config(config, loaded_config)

                # 确保节点ID存在
                if not config.get("nodeId"):
                    config["nodeId"] = f"node-{uuid.uuid4().hex[:8]}"
                    logger.info(f"生成新的节点ID: {config['nodeId']}")

                return config
        except Exception as e:
            logger.error(f"加载配置文件出错: {str(e)}")

    # 如果配置文件不存在或加载失败，使用默认配置并保存
    logger.info(f"使用默认配置并保存到 {CONFIG_FILE}")
    save_config(config)
    return config
```

#### 节点注册

```python
async def register_node():
    """向主控服务器注册节点"""
    global service_running, config

    if not service_running:
        logger.warning("服务未运行，跳过节点注册")
        return False

    try:
        session = await get_http_session()

        # 确定节点地址
        # 检查是否使用公网地址
        use_public_address = config.get("usePublicAddress", False)

        if use_public_address and config.get("publicIp"):
            # 使用配置的公网IP和端口
            host_ip = config.get("publicIp")
            node_port = config.get("publicPort") or config.get("nodePort", 8001)
            logger.info(f"使用配置的公网地址: {host_ip}:{node_port}")
        else:
            # 获取本机地址，使用配置中的端口
            host_name = socket.gethostname()
            host_ip = socket.gethostbyname(host_name)
            node_port = config.get("nodePort", 8001)  # 从配置中获取端口号
            logger.info(f"使用自动检测的本地地址: {host_ip}:{node_port}")

        node_address = f"{host_ip}:{node_port}"

        node_info = {
            "node_id": NODE_ID,
            "address": node_address,
            "status": "online"
        }

        logger.info(f"正在向主控服务器 {MAIN_SERVER_URL} 注册节点")
        logger.info(f"节点地址: {node_address}")

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
    global last_sync_time, last_sync_status, service_running, config

    if not service_running:
        logger.warning("服务未运行，跳过同步会议数据")
        return False

    # 获取网络配置
    network_config = get_network_config(config)
    connection_timeout = network_config["connectionTimeout"]
    download_timeout = network_config["downloadTimeout"]
    retry_count = network_config["retryCount"]
    retry_delay = network_config["retryDelay"]

    try:
        logger.info(f"开始同步会议数据: {meeting_id}")
        last_sync_status = "同步中"

        # 获取存储配置
        storage_config = get_storage_config(config)
        storage_path = storage_config["path"]

        # 创建会议目录（只使用一个位置，避免存储冗余）
        meeting_folder = os.path.join(storage_path, f"meeting_{meeting_id}")
        os.makedirs(meeting_folder, exist_ok=True)

        # 获取会议包路径
        package_path = os.path.join(meeting_folder, "package.zip")

        # 从主控服务器下载会议包，支持重试
        session = await get_http_session()
        success = False

        for attempt in range(retry_count):
            try:
                logger.info(f"尝试下载会议包 {attempt+1}/{retry_count}: {meeting_id}")

                async with session.get(
                    f"{MAIN_SERVER_URL}/api/v1/meetings/{meeting_id}/download-package-direct",
                    timeout=download_timeout
                ) as response:
                    if response.status == 200:
                        # 读取响应内容
                        content = await response.read()

                        # 确保目录存在
                        os.makedirs(os.path.dirname(package_path), exist_ok=True)

                        # 保存到文件
                        with open(package_path, "wb") as f:
                            f.write(content)
                        logger.info(f"成功保存会议包到: {package_path}")

                        # 更新同步状态
                        last_sync_time = time.time()
                        last_sync_status = "同步成功"

                        logger.info(f"会议 {meeting_id} 同步完成，包大小: {len(content)} 字节")
                        success = True
                        break
                    else:
                        logger.warning(f"下载会议包失败: HTTP {response.status}，尝试 {attempt+1}/{retry_count}")
                        if attempt < retry_count - 1:
                            await asyncio.sleep(retry_delay)
            except Exception as e:
                logger.warning(f"下载会议包出错: {str(e)}，尝试 {attempt+1}/{retry_count}")
                if attempt < retry_count - 1:
                    await asyncio.sleep(retry_delay)

        if not success:
            last_sync_status = "同步失败: 下载失败"
            logger.error(f"会议 {meeting_id} 同步失败，已尝试 {retry_count} 次")
            return False

        return success
    except Exception as e:
        last_sync_status = f"同步出错: {str(e)}"
        logger.error(f"同步会议数据出错: {str(e)}")
        return False
```

#### 文件下载API

```python
@app.get("/api/v1/meetings/{meeting_id}/download-package")
async def download_meeting_package(meeting_id: str):
    """提供会议包下载，与主控服务器API兼容"""
    global service_running

    if not service_running:
        raise HTTPException(status_code=503, detail="服务未运行")

    # 构建本地存储路径
    package_path = os.path.join(STORAGE_PATH, f"meeting_{meeting_id}", "package.zip")

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

## 配置管理

分布式文件服务节点使用JSON配置文件进行配置管理，支持通过Web界面或API进行配置更新。

### 配置文件

配置文件 `node_config.json` 包含以下主要配置项：

```json
{
    "mainServerIp": "192.168.110.10",
    "mainServerPort": 80,
    "syncInterval": 10,
    "nodeId": "node-12345678",
    "nodePort": 8001,
    "publicIp": null,
    "publicPort": null,
    "usePublicAddress": false,
    "storage": {
        "path": "./storage",
        "maxSize": 10737418240,
        "cleanupThreshold": 0.9,
        "autoCleanup": true
    },
    "network": {
        "maxConcurrentDownloads": 3,
        "downloadTimeout": 300,
        "connectionTimeout": 10,
        "retryCount": 3,
        "retryDelay": 5
    },
    "logging": {
        "level": "INFO",
        "fileEnabled": true,
        "filePath": "./logs/node.log",
        "maxFileSize": 10485760,
        "backupCount": 5
    },
    "heartbeat": {
        "interval": 10,
        "timeout": 30
    },
    "cleanup": {
        "enabled": true,
        "cleanOnStartup": true,
        "cleanEndedMeetings": true
    }
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| mainServerIp | 字符串 | "192.168.110.10" | 主控服务器IP地址 |
| mainServerPort | 整数 | 80 | 主控服务器端口 |
| syncInterval | 整数 | 10 | 同步间隔(秒) |
| nodeId | 字符串 | 自动生成 | 节点唯一标识 |
| nodePort | 整数 | 8001 | 节点服务端口 |
| publicIp | 字符串 | null | 节点公网IP，为null时自动检测 |
| publicPort | 整数 | null | 节点公网端口，为null时使用nodePort |
| usePublicAddress | 布尔值 | false | 是否使用公网地址注册节点 |

#### 存储配置 (storage)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| path | 字符串 | "./storage" | 存储路径 |
| maxSize | 整数 | 10737418240 | 最大存储大小(10GB) |
| cleanupThreshold | 浮点数 | 0.9 | 清理阈值(90%) |
| autoCleanup | 布尔值 | true | 是否自动清理 |

#### 网络配置 (network)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| maxConcurrentDownloads | 整数 | 3 | 最大并发下载数 |
| downloadTimeout | 整数 | 300 | 下载超时时间(秒) |
| connectionTimeout | 整数 | 10 | 连接超时时间(秒) |
| retryCount | 整数 | 3 | 重试次数 |
| retryDelay | 整数 | 5 | 重试延迟(秒) |

#### 日志配置 (logging)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| level | 字符串 | "INFO" | 日志级别 |
| fileEnabled | 布尔值 | true | 是否启用文件日志 |
| filePath | 字符串 | "./logs/node.log" | 日志文件路径 |
| maxFileSize | 整数 | 10485760 | 最大日志文件大小(10MB) |
| backupCount | 整数 | 5 | 备份文件数量 |

#### 心跳配置 (heartbeat)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| interval | 整数 | 10 | 心跳间隔(秒) |
| timeout | 整数 | 30 | 心跳超时时间(秒) |

#### 清理配置 (cleanup)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | 布尔值 | true | 是否启用自动清理 |
| cleanOnStartup | 布尔值 | true | 启动时清理 |
| cleanEndedMeetings | 布尔值 | true | 清理已结束的会议 |

### 配置更新方式

1. **直接编辑配置文件**：
   - 编辑 `node_config.json` 文件
   - 重启服务使配置生效

2. **通过Web界面**：
   - 访问节点Web界面 `http://节点IP:端口/static/index.html`
   - 在配置页面修改配置
   - 点击保存按钮应用配置

3. **通过API**：
   - 使用POST请求更新配置：`POST /api/config`
   - 请求体为JSON格式的配置数据

## 部署指南

### 环境要求

- Python 3.7+
- 网络连接到主控服务器
- 足够的存储空间用于会议文件

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

使用启动脚本启动服务：

```bash
python start.py --host 0.0.0.0 --port 8001
```

注意：其他配置项（如主控服务器地址、同步间隔等）应通过配置文件或Web界面设置，而不是通过命令行参数。

### 验证部署

1. 访问节点Web界面：
   ```
   http://节点IP:8001/static/index.html
   ```

2. 检查节点状态：
   ```
   http://节点IP:8001/api/status
   ```

3. 检查节点是否已在主控服务器注册：
   ```
   curl http://主控服务器IP:端口/api/v1/nodes/list
   ```

## API参考

分布式文件服务节点提供以下API接口：

### 文件下载API

#### 下载会议包（主控服务器兼容API）

```
GET /api/v1/meetings/{meeting_id}/download-package
```

下载指定会议的文件包，与主控服务器API兼容。

**参数**：
- `meeting_id`：会议ID

**响应**：
- 成功：返回文件内容，Content-Type为application/zip
- 失败：返回404错误（会议不存在）或503错误（服务未运行）

#### 下载会议包（前端兼容API）

```
GET /api/meetings/{meeting_id}/download
```

下载指定会议的文件包，与前端下载链接兼容。

**参数**：
- `meeting_id`：会议ID

**响应**：
- 成功：返回文件内容，Content-Type为application/zip
- 失败：返回404错误（会议不存在）或503错误（服务未运行）

### 配置管理API

#### 获取配置

```
GET /api/config
```

获取当前节点配置。

**响应**：
- 成功：返回JSON格式的配置数据

#### 更新配置

```
POST /api/config
```

更新节点配置。

**请求体**：
- JSON格式的配置数据

**响应**：
- 成功：返回`{"status": "success", "message": "配置已更新"}`
- 失败：返回400错误（请求格式错误）或500错误（保存失败）

#### 更新心跳间隔（兼容旧版）

```
POST /api/config/heartbeat
```

更新心跳间隔，兼容旧版API。

**请求体**：
- 整数值或JSON格式的`{"interval": 30}`

**响应**：
- 成功：返回`{"status": "success", "message": "心跳间隔已更新为 30 秒"}`
- 失败：返回400错误（无效的心跳间隔）

### 服务控制API

#### 启动服务

```
POST /api/service/start
```

启动文件服务。

**响应**：
- 成功：返回`{"status": "success", "message": "服务已启动"}`

#### 停止服务

```
POST /api/service/stop
```

停止文件服务。

**响应**：
- 成功：返回`{"status": "success", "message": "服务已停止"}`

### 状态查询API

```
GET /api/status
```

获取节点状态信息。

**响应**：
- 成功：返回JSON格式的状态数据，包含节点ID、运行状态、连接状态、会议信息等

## 故障排除

### 常见问题

1. **节点无法连接到主控服务器**
   - 检查配置文件中的主控服务器IP和端口是否正确
   - 确认网络连接是否正常
   - 检查主控服务器是否在运行
   - 检查防火墙设置是否允许连接

2. **文件同步失败**
   - 检查主控服务器的下载API是否可用
   - 确认存储目录是否有写入权限
   - 检查磁盘空间是否充足
   - 检查网络配置中的超时设置和重试次数

3. **下载请求返回404**
   - 确认会议ID是否正确
   - 检查会议文件是否已同步
   - 查看日志了解详细错误信息
   - 尝试手动触发同步：访问`/api/status`查看同步状态

4. **节点注册失败**
   - 检查节点地址配置是否正确
   - 如果使用公网地址，确认`publicIp`和`publicPort`设置正确
   - 确认主控服务器的节点注册API是否可用

5. **Web界面无法访问**
   - 确认节点服务是否正在运行
   - 检查端口是否被占用
   - 确认浏览器是否能访问节点IP和端口

### 日志分析

日志记录了节点的运行状态和错误信息，可以通过分析日志来排查问题：

```
2023-05-15 10:15:30 - file_node - INFO - 文件服务节点已启动 [ID: node-1234]
2023-05-15 10:15:31 - file_node - INFO - 节点注册成功
2023-05-15 10:15:32 - file_node - INFO - 开始同步会议数据...
2023-05-15 10:15:33 - file_node - INFO - 当前没有活动会议
```

### 常见错误码

| 错误码 | 说明 | 解决方法 |
|--------|------|----------|
| 404 | 会议包不存在 | 检查会议ID是否正确，尝试手动触发同步 |
| 503 | 服务未运行 | 通过API或Web界面启动服务 |
| 500 | 服务器内部错误 | 查看日志了解详细错误信息 |
| 400 | 请求参数错误 | 检查请求格式是否正确 |

### 重置节点

如果节点出现严重问题，可以尝试重置节点：

1. 停止节点服务
2. 删除`node_config.json`文件（将使用默认配置重新生成）
3. 清空`storage`目录
4. 重新启动节点服务

## 性能优化

### 优化建议

1. **配置优化**：
   - 根据网络环境调整连接超时和重试参数
   - 根据服务器性能调整同步间隔
   - 根据实际需求调整心跳间隔

2. **存储优化**：
   - 启用自动清理功能，及时释放存储空间
   - 调整清理阈值，避免存储空间不足
   - 使用SSD存储提高文件读写性能

3. **网络优化**：
   - 如果节点部署在公网，正确配置公网IP和端口
   - 调整下载超时时间，适应大文件传输
   - 增加重试次数，提高同步成功率

4. **日志优化**：
   - 生产环境使用INFO或WARNING级别减少日志量
   - 启用日志文件轮转，避免单个日志文件过大
   - 定期清理旧日志文件

### 扩展建议

1. **多节点部署**：
   - 在不同地理位置部署多个节点
   - 在主控服务器配置节点优先级和分配策略
   - 实现基于地理位置的智能路由

2. **负载均衡**：
   - 主控服务器根据节点负载分配下载请求
   - 考虑节点的CPU、内存、网络状况进行智能分配
   - 实现动态调整节点权重的机制

3. **监控系统**：
   - 集成Prometheus等监控工具
   - 监控节点的CPU、内存、磁盘使用情况
   - 设置自动告警机制，及时发现问题

4. **安全加固**：
   - 实现节点与主控服务器之间的认证机制
   - 加密传输敏感数据
   - 实现IP白名单限制访问
   - 定期更新依赖库，修复安全漏洞

### 与主控服务器集成优化

1. **智能分发**：
   - 主控服务器根据节点地理位置和负载分发下载请求
   - 实现就近下载，提高下载速度

2. **健康检查**：
   - 主控服务器定期检查节点健康状态
   - 自动剔除不健康的节点，避免下载失败

3. **自动扩缩容**：
   - 根据系统负载自动增加或减少节点数量
   - 在高峰期自动启动更多节点，低谷期关闭闲置节点

4. **数据一致性**：
   - 实现会议文件的版本控制
   - 确保所有节点同步的是最新版本的会议文件
