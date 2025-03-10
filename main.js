const { dialog, app, BrowserWindow, ipcMain } = require('electron');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 定义存储数据的文件路径
const dataFilePath = path.join(app.getPath('userData'), 'commands.json');

// 读取存储的数据
function readCommandsFromFile() {
    try {
        const data = fs.readFileSync(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// 将数据写入文件
function writeCommandsToFile(commands) {
    console.log('writeCommandsToFile', commands[0].file);
    const data = JSON.stringify(commands, null, 2);
    fs.writeFileSync(dataFilePath, data, 'utf8');
}

let mainWindow;
const runningProcesses = {};

function createWindow() {

    mainWindow = new BrowserWindow({
        width: 800,
        minWidth: 400,
        height: 600,
        minHeight: 400,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools();

    mainWindow.on('close', function (e) {
        // 检查是否有正在运行的进程
        if (Object.keys(runningProcesses).length > 0) {

            const choice = dialog.showMessageBoxSync(mainWindow, {
                type: 'question',
                buttons: ['取消', '确认关闭'],
                title: '确认关闭',
                message: `有${Object.keys(runningProcesses).length}个程序正在执行，确认关闭窗口吗？`
            });
            if (choice === 1) { // 用户选择了确认关闭
                // 遍历所有正在运行的进程并终止
                for (const fullCommand in runningProcesses) {
                    const child = runningProcesses[fullCommand];
                    child.kill();
                    delete runningProcesses[fullCommand];
                }
                // 允许窗口关闭
                mainWindow = null;
            } else {
                // 阻止窗口关闭
                e.preventDefault();
            }
        } else {
            // 没有正在运行的进程，直接关闭窗口
            mainWindow = null;
        }
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform == 'darwin') app.quit();
});

// 监听来自渲染进程的命令执行请求
ipcMain.on('execute-command', (event, { index, command: commandObj }) => {
    let child;
    if (commandObj.type === 'python') {
        console.log('执行python命令', commandObj.file);
        if (commandObj.file) {
            // const filePath = path.resolve(commandObj.file);
            const fileDir = path.dirname(commandObj.file);
            const venvPath = path.join(fileDir, 'venv');
            // console.log('venvPath', venvPath);
            if (fs.existsSync(venvPath)) {
                // console.log('存在 venv 目录');
                // 存在 venv 目录，使用 venv 中的 Python 解释器
                const pythonPath = path.join(venvPath, 'bin', 'python');
                child = spawn(pythonPath, [commandObj.file], {
                    cwd: fileDir, // 设置工作目录为文件所在目录
                    shell: true
                });
            } else {
                // 不存在 venv 目录，使用默认 Python 解释器
                child = spawn('/opt/homebrew/bin/python3', [commandObj.file], {
                    cwd: fileDir, // 设置工作目录为文件所在目录,
                    shell: true,
                });
            }
        } else {
            // 没有指定文件，使用默认 Python 解释器执行命令
            mainWindow.webContents.send('command-executed', { index, code: -1 });
        }
    } else if (commandObj.type === 'shell') {
        const [command, ...args] = commandObj.command.split(' ');
        child = spawn(command, args, { shell: true });
    }

    if (child) {
        // 将子进程添加到 runningProcesses 中
        runningProcesses[`child-${index}`] = child;

        // 监听子进程的输出
        child.stdout.on('data', (data) => {
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('command-output', { index, output: data.toString() });
            }
        });

        // 监听子进程的错误输出
        child.stderr.on('data', (data) => {
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('command-output', { index, output: data.toString() });
            }
        });

        // 监听子进程的关闭事件
        child.on('close', (code) => {
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('command-executed', { index, code });
                delete runningProcesses[`child-${index}`];
            }
        });
    }
});

// 监听来自渲染进程的停止命令请求
ipcMain.on('stop-command', (event, { index, command }) => {
    console.log('停止命令', command.type, command.type === 'python' ? command.file : command.command, index);
    let child = runningProcesses[`child-${index}`];
    if (child) {
        // python 需要pkill终止进程
        if (command.type === 'python') {
            // 向子进程的 stdin 发送 Ctrl + C 对应的字符代码
            child.stdin.write('\x03');
        }
        child.kill('SIGKILL');
        // child.stdin.write('\x03');
    }
});

// 监听应用退出事件
app.on('will-quit', (event) => {
    event.preventDefault();
    // 遍历所有正在运行的进程并终止
    console.log('遍历所有正在运行的进程并终止');
    for (const key in runningProcesses) {
        const child = runningProcesses[key];
        child.kill();
        delete runningProcesses[key];
    }
    //遍历localStorage的commands，修改status为stopped
    const commands = readCommandsFromFile();
    commands.forEach(command => {
        command.status = 'stopped'; // 修改状态为停止
    });
    writeCommandsToFile(commands);// 保存修改后的数据
    console.log('应用即将退出');
    app.exit();//    退出应用
});

// 监听渲染进程请求读取命令数据
ipcMain.on('read-commands', (event) => {
    const commands = readCommandsFromFile();
    event.sender.send('commands-read', commands);
});

// 监听渲染进程请求写入命令数据
ipcMain.on('write-commands', (event, commands) => {
    writeCommandsToFile(commands);
});