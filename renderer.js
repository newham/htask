const { ipcRenderer } = require('electron');

const app = vue.createApp({
    data() {
        return {
            commands: JSON.parse(localStorage.getItem('commands')) || [],
            commandNote: '',
            commandType: 'python',
            scriptFile: null,
            commandInput: '',
            editIndex: -1
        };
    },
    methods: {
        showModal(isEdit = false) {
            if (!isEdit) {
                this.commandNote = '';
                this.commandType = 'python';
                this.scriptFile = null;
                this.commandInput = '';
                this.editIndex = -1;
            }
            document.getElementById('add-command-modal').style.display = 'flex';
        },
        hideModal() {
            document.getElementById('add-command-modal').style.display = 'none';
        },
        saveCommand() {
            if (this.commandNote && (this.scriptFile || this.commandInput)) {
                const newCommand = {
                    note: this.commandNote,
                    type: this.commandType,
                    file: this.scriptFile ? this.scriptFile.name : null,
                    command: this.commandInput,
                    status: 'stopped'
                };
                if (this.editIndex !== -1) {
                    this.commands[this.editIndex] = newCommand;
                    this.editIndex = -1;
                } else {
                    this.commands.push(newCommand);
                }
                localStorage.setItem('commands', JSON.stringify(this.commands));
                this.commandNote = '';
                this.commandType = 'python';
                this.scriptFile = null;
                this.commandInput = '';
                this.hideModal();
                console.log(this.commands);
            } else {
                alert('脚本位置和命令至少输入一个！');
            }
        },
        async toggleStatus(index) {
            const commandObj = this.commands[index];
            if (commandObj.status === 'stopped') {
                commandObj.status = 'running';
                localStorage.setItem('commands', JSON.stringify(this.commands));

                // 构建要执行的命令
                let fullCommand = '';
                if (commandObj.type === 'python') {
                    if (commandObj.file) {
                        fullCommand = `python ${commandObj.file}`;
                    } else {
                        fullCommand = `python -c "${commandObj.command}"`;
                    }
                } else if (commandObj.type === 'shell') {
                    if (commandObj.file) {
                        fullCommand = `sh ${commandObj.file}`;
                    } else {
                        fullCommand = commandObj.command;
                    }
                }

                try {
                    const result = await ipcRenderer.invoke('execute-command', fullCommand);
                    console.log('命令执行结果:', result.stdout);
                    if (result.stderr) {
                        console.error('命令执行产生错误输出:', result.stderr);
                    }
                } catch (error) {
                    console.error('执行命令时出错:', error);
                } finally {
                    commandObj.status = 'stopped';
                    localStorage.setItem('commands', JSON.stringify(this.commands));
                }
            } else {
                // 停止命令执行逻辑，这里暂时简单设置状态为停止
                commandObj.status = 'stopped';
                localStorage.setItem('commands', JSON.stringify(this.commands));
            }
        },
        deleteCommand(index) {
            if (confirm('确定要删除该命令吗？')) {
                this.commands.splice(index, 1);
                localStorage.setItem('commands', JSON.stringify(this.commands));
            }
        },
        editCommand(index) {
            const commandObj = this.commands[index];
            this.commandNote = commandObj.note;
            this.commandType = commandObj.type;
            this.scriptFile = null;
            this.commandInput = commandObj.command;
            this.editIndex = index;
            this.showModal(true);
        }
    }
});

app.mount('#app');
