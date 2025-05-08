"""
分布式文件服务节点启动脚本

此脚本用于启动分布式文件服务节点，支持通过命令行参数配置节点。
"""
import argparse
import uvicorn
import socket
from config import load_config

def main():
    """启动分布式文件服务节点"""
    parser = argparse.ArgumentParser(description='启动分布式文件服务节点')

    # 添加命令行参数
    parser.add_argument('--host', type=str, default='0.0.0.0', help='监听主机地址')
    parser.add_argument('--port', type=int, help='监听端口，如果不指定则使用配置文件中的端口')
    parser.add_argument('--main-server-ip', type=str, help='主控服务器IP')
    parser.add_argument('--main-server-port', type=int, help='主控服务器端口')
    parser.add_argument('--storage-path', type=str, help='文件存储路径')
    parser.add_argument('--sync-interval', type=int, help='同步间隔(秒)')
    parser.add_argument('--node-id', type=str, help='节点ID')

    # 解析命令行参数
    args = parser.parse_args()

    # 加载配置
    config = load_config()
    print("配置加载成功:", config)

    # 如果命令行没有指定端口，则使用配置文件中的端口
    port = args.port if args.port is not None else config.get("nodePort", 8001)
    print(f"使用端口: {port}")

    # 我们不再使用环境变量，而是通过配置文件管理设置
    # 打印警告信息，提示用户通过配置文件或Web界面设置
    if args.storage_path or args.node_id or args.main_server_ip or args.main_server_port:
        print("注意: 节点配置通过配置文件或Web界面设置，命令行参数将被忽略")

    # 打印启动信息
    print(f"启动分布式文件服务节点...")
    print(f"监听地址: {args.host}:{port}")
    print(f"节点ID: {config.get('nodeId', '未设置')}")
    print(f"主控服务器: {config.get('mainServerIp', '未设置')}:{config.get('mainServerPort', '未设置')}")

    # 获取本机IP地址
    try:
        host_name = socket.gethostname()
        host_ip = socket.gethostbyname(host_name)
        print(f"节点IP地址: {host_ip}")
        print(f"节点完整地址: {host_ip}:{port}")
    except:
        print(f"无法获取节点IP地址，将使用默认地址")

    # 启动服务
    print("准备启动服务...")
    print(f"使用模块: main:app")
    print(f"主机: {args.host}")
    print(f"端口: {port}")

    uvicorn.run(
        "main:app",
        host=args.host,
        port=port,
        reload=False
    )

if __name__ == "__main__":
    main()
