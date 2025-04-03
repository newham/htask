#!/bin/bash
icon="./assets/img/icon.png"
# 检查图标文件是否存在
if [ ! -f "$icon" ]; then
    echo "图标文件 $icon 不存在，请检查路径。"
    exit 1
fi
cp ./build/*.AppImage ~/App

# 遍历当前目录下的所有 .AppImage 文件
for appimage in ./build/*.AppImage; do
    # 检查文件是否存在
    if [ -f "$appimage" ]; then
        # 获取应用程序名称
        app_name=$(basename "$appimage" .AppImage)

        cp $icon ~/App/${app_name}.png

        # 创建桌面文件
        desktop_file="$HOME/.local/share/applications/${app_name}.desktop"
        cat << EOF > "$desktop_file"
[Desktop Entry]
Name=$app_name
Exec=$HOME/App/${app_name}.AppImage
Icon=$HOME/App/${app_name}.png
Terminal=false
Type=Application
Categories=Utility;
EOF

        # 使桌面文件可执行
        chmod +x "$desktop_file"

        # 更新应用程序缓存
        update-desktop-database ~/.local/share/applications

        echo "已将 $appimage 添加到软件库，并设置图标。"
    fi
done