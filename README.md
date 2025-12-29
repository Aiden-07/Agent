# 部署说明

本项目包含前端界面（HTML/JS）和后端服务（Python），文档系统的读写依赖于后端服务。

## 快速启动（推荐）

在服务器上解压后，直接运行 Python 服务即可同时提供页面访问和文档 API 支持。

1. 确保服务器安装了 Python 3.x。
2. 在项目根目录下运行：
   ```bash
   python server.py
   ```
3. 访问 `http://服务器IP:8000` 即可使用。

> 注意：如果服务器有防火墙，请确保开放 8000 端口。

## 使用 Nginx + Python（生产环境）

如果你希望通过 Nginx 部署（例如使用 80 端口），需要配置反向代理，将 API 请求转发给 Python 服务。

1. **启动 Python 服务**：
   在后台运行 Python 服务（建议使用 `nohup` 或 `systemd`）：
   ```bash
   nohup python server.py > server.log 2>&1 &
   ```
   此时服务运行在 8000 端口。

2. **配置 Nginx**：
   在 Nginx 配置中添加 `/api` 的转发规则。

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /path/to/your/project;  # 指向项目解压目录
       index index.html;

       # 静态文件直接由 Nginx 处理
       location / {
           try_files $uri $uri/ /index.html;
       }

       # API 请求转发给 Python 服务
       location /api/ {
           proxy_pass http://127.0.0.1:8000/api/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 常见问题

**Q: 为什么看不到文档内容？**
A: 可能是 Python 服务未运行，或者 Nginx 没有正确转发 `/api` 请求。请检查浏览器控制台（F12 -> Network）是否有 404 错误。

**Q: 为什么无法保存文档？**
A: 请确保服务器上的 `prototype_comments` 目录具有写入权限。
   ```bash
   chmod -R 755 prototype_comments
   ```
