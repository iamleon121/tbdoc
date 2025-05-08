// 全局变量
let serviceRunning = true; // 默认服务启动
let connectionStatus = false;
let startTime = null;
let configData = {
    mainServerIp: '192.168.110.10',
    mainServerPort: 80,
    syncInterval: 10,
    nodePort: 8001
};

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化页面
    initPage();

    // 绑定事件处理函数
    bindEvents();

    // 定时更新状态
    setInterval(updateStatus, 10000);

    // 自动启动服务
    setTimeout(function() {
        if (serviceRunning) {
            startService();
        }
    }, 1000);
});

// 初始化页面
function initPage() {
    // 获取节点配置
    fetchConfig();

    // 获取节点状态
    fetchStatus();

    // 更新UI状态
    updateUI();
}

// 绑定事件处理函数
function bindEvents() {
    // 配置表单提交
    document.getElementById('configForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveConfig();
    });

    // 重置配置按钮
    document.getElementById('resetConfig').addEventListener('click', function() {
        resetConfig();
    });

    // 切换服务按钮
    document.getElementById('toggleService').addEventListener('click', function() {
        toggleService();
    });

    // 关闭通知按钮
    document.getElementById('closeNotification').addEventListener('click', function() {
        hideNotification();
    });
}

// 获取节点配置
function fetchConfig() {
    fetch('/api/config')
        .then(response => {
            if (!response.ok) {
                throw new Error('获取配置失败');
            }
            return response.json();
        })
        .then(data => {
            configData = data;
            updateConfigForm();
        })
        .catch(error => {
            showNotification(error.message, 'error');
            console.error('获取配置错误:', error);
        });
}

// 更新配置表单
function updateConfigForm() {
    document.getElementById('mainServerIp').value = configData.mainServerIp || '192.168.110.10';
    document.getElementById('mainServerPort').value = configData.mainServerPort || 80;
    document.getElementById('nodePort').value = configData.nodePort || 8001;
    document.getElementById('syncInterval').value = configData.syncInterval || 10;

    // 设置心跳间隔
    const heartbeatInterval = configData.heartbeat && configData.heartbeat.interval
        ? configData.heartbeat.interval
        : 30;
    document.getElementById('heartbeatInterval').value = heartbeatInterval;

    // 设置公网访问配置
    document.getElementById('usePublicAddress').checked = configData.usePublicAddress || false;
    document.getElementById('publicIp').value = configData.publicIp || '';
    document.getElementById('publicPort').value = configData.publicPort || '';

    // 设置清理配置
    const cleanup = configData.cleanup || {};
    document.getElementById('cleanupEnabled').checked = cleanup.enabled !== false; // 默认为true
    document.getElementById('cleanOnStartup').checked = cleanup.cleanOnStartup !== false; // 默认为true
    document.getElementById('cleanEndedMeetings').checked = cleanup.cleanEndedMeetings !== false; // 默认为true
}

// 保存配置
function saveConfig() {
    const mainServerIp = document.getElementById('mainServerIp').value.trim();
    const mainServerPort = parseInt(document.getElementById('mainServerPort').value);
    const nodePort = parseInt(document.getElementById('nodePort').value);
    const syncInterval = parseInt(document.getElementById('syncInterval').value);
    const heartbeatInterval = parseInt(document.getElementById('heartbeatInterval').value);

    if (!mainServerIp) {
        showNotification('请输入主控服务器IP', 'warning');
        return;
    }

    if (isNaN(mainServerPort) || mainServerPort < 1 || mainServerPort > 65535) {
        showNotification('请输入有效的主控服务器端口号(1-65535)', 'warning');
        return;
    }

    if (isNaN(nodePort) || nodePort < 1 || nodePort > 65535) {
        showNotification('请输入有效的节点服务端口号(1-65535)', 'warning');
        return;
    }

    if (isNaN(heartbeatInterval) || heartbeatInterval < 10 || heartbeatInterval > 300) {
        showNotification('请输入有效的心跳间隔(10-300秒)', 'warning');
        return;
    }

    // 获取公网访问配置
    const usePublicAddress = document.getElementById('usePublicAddress').checked;
    const publicIp = document.getElementById('publicIp').value.trim();
    const publicPort = document.getElementById('publicPort').value.trim() ? parseInt(document.getElementById('publicPort').value) : null;

    // 如果启用了公网地址但没有填写公网IP，显示警告
    if (usePublicAddress && !publicIp) {
        showNotification('请输入公网IP地址', 'warning');
        return;
    }

    // 如果填写了公网端口但不是有效的端口号，显示警告
    if (publicPort !== null && (isNaN(publicPort) || publicPort < 1 || publicPort > 65535)) {
        showNotification('请输入有效的公网端口号(1-65535)', 'warning');
        return;
    }

    // 获取清理配置
    const cleanupEnabled = document.getElementById('cleanupEnabled').checked;
    const cleanOnStartup = document.getElementById('cleanOnStartup').checked;
    const cleanEndedMeetings = document.getElementById('cleanEndedMeetings').checked;

    const newConfig = {
        mainServerIp,
        mainServerPort,
        nodePort,
        syncInterval,
        usePublicAddress,
        publicIp: usePublicAddress ? publicIp : null,
        publicPort: usePublicAddress ? publicPort : null,
        heartbeat: {
            interval: heartbeatInterval,
            timeout: heartbeatInterval * 3 // 超时时间设为心跳间隔的3倍
        },
        cleanup: {
            enabled: cleanupEnabled,
            cleanOnStartup: cleanOnStartup,
            cleanEndedMeetings: cleanEndedMeetings
        }
    };

    fetch('/api/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConfig)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('保存配置失败');
            }
            return response.json();
        })
        .then(data => {
            configData = newConfig;
            showNotification('配置保存成功', 'success');
        })
        .catch(error => {
            showNotification(error.message, 'error');
            console.error('保存配置错误:', error);
        });
}

// 重置配置
function resetConfig() {
    updateConfigForm();
    showNotification('配置已重置', 'info');
}

// 获取节点状态
function fetchStatus() {
    console.log("开始获取状态...");
    fetch('/api/status')
        .then(response => {
            if (!response.ok) {
                throw new Error('获取状态失败');
            }
            return response.json();
        })
        .then(data => {
            console.log("获取状态成功:", data);
            updateStatusData(data);
        })
        .catch(error => {
            console.error('获取状态错误:', error);
            // 设置连接状态为离线
            connectionStatus = false;
            updateUI();
        });
}

// 更新状态数据
function updateStatusData(data) {
    // 更新节点ID
    document.getElementById('nodeId').textContent = data.node_id || '未知';

    // 更新节点IP地址和端口
    try {
        // 直接从状态数据中获取节点IP和端口
        const nodeIp = data.node_ip || '未知';
        const nodePort = data.node_port || 8001;
        document.getElementById('nodeIp').textContent = `${nodeIp}:${nodePort}`;
    } catch (e) {
        console.error('获取节点IP地址出错:', e);
        document.getElementById('nodeIp').textContent = '未知';
    }

    // 更新运行状态
    serviceRunning = data.running || false;

    // 更新连接状态
    // 如果同步状态为"同步成功"，则认为连接正常
    const syncStatus = data.sync_status || '未知';
    const syncSuccessful = syncStatus === '同步成功';

    // 使用服务器返回的连接状态或根据同步状态判断
    connectionStatus = data.connected || syncSuccessful;
    console.log("连接状态:", connectionStatus, "同步状态:", syncStatus);

    // 更新最近同步时间
    if (data.last_sync) {
        const lastSyncDate = new Date(data.last_sync * 1000);
        document.getElementById('lastSync').textContent = lastSyncDate.toLocaleString();
    } else {
        document.getElementById('lastSync').textContent = '未同步';
    }

    // 更新同步状态
    document.getElementById('syncStatus').textContent = syncStatus;
    console.log("同步状态:", syncStatus);

    // 根据同步状态设置样式
    const syncStatusEl = document.getElementById('syncStatus');
    if (syncStatus.includes('失败') || syncStatus.includes('出错')) {
        syncStatusEl.className = 'status-text error';
    } else if (syncStatus === '同步中') {
        syncStatusEl.className = 'status-text warning';
    } else if (syncStatus === '同步成功') {
        syncStatusEl.className = 'status-text success';
    } else {
        syncStatusEl.className = 'status-text';
    }

    // 更新会议数量
    document.getElementById('meetingCount').textContent = data.meeting_count || 0;

    // 更新存储空间
    document.getElementById('storageUsage').textContent = formatBytes(data.storage_usage || 0);

    // 更新会议列表
    console.log("会议数据:", data.active_meetings);
    updateMeetingsList(data.active_meetings || []);

    // 更新运行时长
    if (data.start_time) {
        startTime = new Date(data.start_time * 1000);
        updateUptime();
    }

    // 更新UI
    updateUI();
}

// 更新UI状态
function updateUI() {
    // 更新运行状态指示器
    const runningStatusEl = document.getElementById('runningStatus');
    const runningIndicator = runningStatusEl.querySelector('.status-indicator');
    const runningText = runningStatusEl.querySelector('.status-text');

    if (serviceRunning) {
        runningIndicator.className = 'status-indicator online';
        runningText.textContent = '运行中';
    } else {
        runningIndicator.className = 'status-indicator offline';
        runningText.textContent = '已停止';
    }

    // 更新连接状态指示器
    const connectionStatusEl = document.getElementById('connectionStatus');
    const connectionIndicator = connectionStatusEl.querySelector('.status-indicator');
    const connectionText = connectionStatusEl.querySelector('.status-text');

    if (connectionStatus) {
        connectionIndicator.className = 'status-indicator online';
        connectionText.textContent = '已连接';
    } else {
        connectionIndicator.className = 'status-indicator offline';
        connectionText.textContent = '未连接';
    }

    // 更新切换按钮状态和文本
    const toggleButton = document.getElementById('toggleService');
    if (serviceRunning) {
        toggleButton.className = 'btn btn-danger';
        toggleButton.textContent = '停止服务';
    } else {
        toggleButton.className = 'btn btn-success';
        toggleButton.textContent = '启动服务';
    }
}

// 启动服务
function startService() {
    fetch('/api/service/start', {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('启动服务失败');
            }
            return response.json();
        })
        .then(data => {
            serviceRunning = true;
            updateUI();
            showNotification('服务已启动', 'success');
            fetchStatus();
        })
        .catch(error => {
            showNotification(error.message, 'error');
            console.error('启动服务错误:', error);
        });
}

// 停止服务
function stopService() {
    fetch('/api/service/stop', {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('停止服务失败');
            }
            return response.json();
        })
        .then(data => {
            serviceRunning = false;
            updateUI();
            showNotification('服务已停止', 'warning');
            fetchStatus();
        })
        .catch(error => {
            showNotification(error.message, 'error');
            console.error('停止服务错误:', error);
        });
}

// 切换服务状态
function toggleService() {
    if (serviceRunning) {
        stopService();
    } else {
        startService();
    }
}

// 更新状态
function updateStatus() {
    fetchStatus();
    if (startTime) {
        updateUptime();
    }
}

// 更新运行时长
function updateUptime() {
    if (!startTime) return;

    const now = new Date();
    const diff = now - startTime;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let uptimeText = '';
    if (days > 0) {
        uptimeText += `${days}天 `;
    }
    if (hours > 0 || days > 0) {
        uptimeText += `${hours}小时 `;
    }
    uptimeText += `${minutes}分钟`;

    document.getElementById('uptime').textContent = uptimeText;
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');

    notification.className = 'notification ' + type;
    notificationMessage.textContent = message;

    // 移除隐藏类
    notification.classList.remove('hidden');

    // 5秒后自动隐藏
    setTimeout(hideNotification, 5000);
}

// 隐藏通知
function hideNotification() {
    const notification = document.getElementById('notification');
    notification.classList.add('hidden');
}

// 格式化字节数
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 更新会议列表
function updateMeetingsList(meetings) {
    const container = document.getElementById('meetingsContainer');

    console.log("更新会议列表:", meetings);

    if (!meetings || meetings.length === 0) {
        console.log("没有会议数据");
        container.innerHTML = '<div class="no-meetings">暂无会议数据</div>';
        return;
    }

    // 确保meetings是数组
    if (!Array.isArray(meetings)) {
        console.error("会议数据不是数组:", meetings);
        container.innerHTML = '<div class="no-meetings">会议数据格式错误</div>';
        return;
    }

    // 按状态对会议进行排序：活动会议在前，已同步会议在后
    meetings.sort((a, b) => {
        // 首先按状态排序
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;

        // 如果状态相同，则按同步时间倒序排序（最新的在前）
        const timeA = a.sync_time || 0;
        const timeB = b.sync_time || 0;
        return timeB - timeA;
    });

    let html = '';

    meetings.forEach(meeting => {
        // 获取同步时间
        const syncTime = meeting.sync_time ? new Date(meeting.sync_time * 1000).toLocaleString() : '未知';

        // 获取文件数量
        const fileCount = meeting.file_count || '未知';

        // 获取会议大小
        const meetingSize = meeting.size ? formatBytes(meeting.size) : '未知';

        // 获取会议状态
        const status = meeting.status || 'synced';
        const statusText = status === 'active' ? '活动' : '已同步';
        const statusClass = status === 'active' ? 'active' : 'synced';

        html += `
            <div class="meeting-card">
                <div class="meeting-header">
                    <div class="meeting-title">${meeting.title || '未命名会议'}</div>
                    <div class="meeting-status ${statusClass}">${statusText}</div>
                </div>
                <div class="meeting-info">
                    <div class="meeting-info-item">
                        <span class="meeting-info-label">会议ID:</span>
                        <span class="meeting-info-value">${meeting.id}</span>
                    </div>
                    <div class="meeting-info-item">
                        <span class="meeting-info-label">同步时间:</span>
                        <span class="meeting-info-value">${syncTime}</span>
                    </div>
                    <div class="meeting-info-item">
                        <span class="meeting-info-label">文件数量:</span>
                        <span class="meeting-info-value">${fileCount}</span>
                    </div>
                    <div class="meeting-info-item">
                        <span class="meeting-info-label">会议大小:</span>
                        <span class="meeting-info-value">${meetingSize}</span>
                    </div>
                </div>
                <div class="meeting-actions">
                    <button class="btn btn-primary meeting-action-btn" onclick="downloadMeetingPackage('${meeting.id}')">
                        下载会议包
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}



// 下载会议包
function downloadMeetingPackage(meetingId) {
    // 创建一个临时链接并点击它来触发下载
    const downloadUrl = `/api/meetings/${meetingId}/download`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `meeting-${meetingId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showNotification('开始下载会议包', 'success');
}

// 注意：单独的心跳间隔更新函数已移除
// 心跳间隔现在与其他配置一起保存
