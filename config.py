"""
配置模块

此模块负责加载和保存节点配置，提供配置管理功能。
"""
import json
import os
import logging
import uuid

# 配置日志
logger = logging.getLogger("config")

# 配置文件路径
CONFIG_FILE = "node_config.json"

# 默认配置
DEFAULT_CONFIG = {
    "mainServerIp": "192.168.110.10",
    "mainServerPort": 80,
    "syncInterval": 10,
    "nodeId": None,  # 节点ID，首次启动时自动生成
    "nodePort": 80,  # 节点服务端口
    "publicIp": None,  # 节点的公网IP，如果为None则自动检测
    "publicPort": None,  # 节点的公网端口，如果为None则使用nodePort
    "usePublicAddress": False,  # 是否使用公网地址注册节点
    "storage": {
        "path": "./storage",  # 存储路径
        "maxSize": 10737418240,  # 最大存储大小（10GB）
        "cleanupThreshold": 0.9,  # 清理阈值（当使用率达到90%时开始清理）
        "autoCleanup": True  # 是否自动清理
    },
    "network": {
        "maxConcurrentDownloads": 100,  # 最大并发下载数
        "downloadTimeout": 300,  # 下载超时时间（秒）
        "connectionTimeout": 10,  # 连接超时时间（秒）
        "retryCount": 3,  # 重试次数
        "retryDelay": 5  # 重试延迟（秒）
    },
    "logging": {
        "level": "INFO",  # 日志级别
        "fileEnabled": True,  # 是否启用文件日志
        "filePath": "./logs/node.log",  # 日志文件路径
        "maxFileSize": 10485760,  # 最大日志文件大小（10MB）
        "backupCount": 5  # 备份文件数量
    },
    "heartbeat": {
        "interval": 10,  # 心跳间隔（秒）
        "timeout": 30  # 心跳超时时间（秒）
    },
    "cleanup": {
        "enabled": True,  # 是否启用自动清理
        "cleanOnStartup": True,  # 启动时清理
        "cleanEndedMeetings": True  # 清理已结束的会议
    }
}

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

def merge_config(target, source):
    """递归合并配置

    将source中的配置合并到target中，保留target中存在但source中不存在的配置
    """
    for key, value in source.items():
        if key in target and isinstance(target[key], dict) and isinstance(value, dict):
            # 如果两边都是字典，递归合并
            merge_config(target[key], value)
        else:
            # 否则直接覆盖
            target[key] = value

def save_config(config):
    """保存配置到配置文件"""
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=4)
        logger.info(f"配置已保存到 {CONFIG_FILE}")
        return True
    except Exception as e:
        logger.error(f"保存配置文件出错: {str(e)}")
        return False

def get_main_server_url(config):
    """根据配置构建主控服务器URL"""
    return f"http://{config['mainServerIp']}:{config['mainServerPort']}"

def get_storage_config(config):
    """获取存储配置"""
    return config.get("storage", DEFAULT_CONFIG["storage"])

def get_network_config(config):
    """获取网络配置"""
    return config.get("network", DEFAULT_CONFIG["network"])

def get_logging_config(config):
    """获取日志配置"""
    return config.get("logging", DEFAULT_CONFIG["logging"])

def get_heartbeat_config(config):
    """获取心跳配置"""
    return config.get("heartbeat", DEFAULT_CONFIG["heartbeat"])

def get_cleanup_config(config):
    """获取清理配置"""
    return config.get("cleanup", DEFAULT_CONFIG["cleanup"])
