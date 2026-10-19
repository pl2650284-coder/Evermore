# Evermore

一个属于两个人的私密桌面空间，用照片、情书与时间线收藏相爱的日常，纪念一起走过的日子，也为未来留下惊喜。

Evermore 是一款恋爱数字博物馆，采用 **Tauri 2 + Next.js + Express + SQLite** 构建。桌面版将界面、本地 API 和 Node.js 运行时一起打包，日常使用无需单独安装 Node.js 或数据库服务；数据保存在本机，可按需连接自己的 S3 兼容对象存储。

## 功能介绍

- **恋爱首页**：设置双方姓名、纪念日、封面和简介，记录相伴的时光。
- **时光轴与地图足迹**：按日期整理回忆，记录一起去过的地方。
- **照片博物馆**：收藏照片，管理标签和喜欢的瞬间。
- **回忆馆**：保存情书、礼物和门票，为每段故事留下纪念。
- **愿望清单与时光胶囊**：记录想一起完成的事，把心意留给未来。
- **成就与年度报告**：回顾共同经历，整理属于两个人的里程碑。
- **个性设置**：切换明暗主题，选择本地音乐文件夹和播放方式。
- **存储与同步**：本地 SQLite 存储、S3 兼容存储同步、媒体缓存管理，以及可配置的桌面应用更新。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Next.js 14、React 18、TypeScript |
| 样式与交互 | Tailwind CSS、Framer Motion、Lucide、ECharts |
| 桌面容器 | Tauri 2、Rust、Windows WebView2 |
| 本地服务 | Node.js、Express |
| 数据存储 | SQLite（Node.js 内置 `node:sqlite`）、本地文件 |
| 可选云存储 | S3 兼容对象存储 |

## 环境准备

从源码运行需要 Git、Node.js **22.13.0 或更高版本**及 npm。项目使用内置 `node:sqlite`，该模块从 Node.js 22.13.0 起无需额外实验参数，详见 [Node.js SQLite 文档](https://nodejs.org/api/sqlite.html)。

开发或打包 Windows 桌面版还需要：

- Rust 工具链及 `x86_64-pc-windows-msvc` 目标。
- Microsoft C++ Build Tools，安装时勾选 **使用 C++ 的桌面开发**。
- Microsoft Edge WebView2 Runtime。

系统依赖的安装步骤见 [Tauri 官方环境准备文档](https://v2.tauri.app/start/prerequisites/)。当前仓库的发行脚本面向 **Windows x64**。

克隆项目并安装前后端依赖：

```bash
git clone https://github.com/pl2650284-coder/Evermore.git
cd Evermore
npm ci
npm ci --prefix backend
```

根目录依赖包含前端构建工具，构建前不要省略开发依赖。

## 方式一：运行与部署 Windows 桌面版

### 本地开发

在项目根目录运行：

```powershell
rustup target add x86_64-pc-windows-msvc
npm run desktop
```

启动器会自动启动前端、本地 API 和桌面窗口，无需另开终端启动后端。开发环境使用端口 `3000` 和 `38489`，数据保存在项目的 `.tauri-dev-data/` 中。首次使用会自动创建本机会话，按页面引导填写双方资料即可。

同一项目重复执行启动命令会恢复已有窗口；关闭桌面窗口后，开发服务也会退出。

### 构建安装包

在 Windows x64 环境中运行：

```powershell
npm run dist:win
```

构建流程会导出前端、准备后端资源、复制当前 Node.js 运行时，并生成 NSIS 安装包。请使用 **Windows x64 版本的 Node.js** 进行打包。

安装包输出目录：

```text
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/
```

将生成的 `Evermore_<版本号>_x64-setup.exe` 分发给使用者并安装即可。使用者无需安装 Rust、npm 或独立的 Node.js；运行环境需要 WebView2。

`npm run build:desktop` 只生成 `out/` 静态界面，不包含安装包和后端，单独上传该目录无法提供完整功能。

桌面更新签名、更新文件发布和旧版数据迁移步骤见 [DESKTOP.md](./DESKTOP.md)。未配置更新地址和公钥时，应用内的更新检查不会启用。

## 方式二：在浏览器中运行

适合本机调试或受控的私人环境，不需要安装 Rust。浏览器模式需要同时运行 Next.js 前端与 Express 后端。

> 当前普通用户流程会通过 `/api/auth/local` 自动建立本机会话；管理页面也保留了开发用登录逻辑。现有认证流程面向本机使用，不能将其当作面向公网的账户隔离机制。如需远程访问，应通过 VPN 或带独立身份验证的访问网关保护整个站点及 API，并保持后端只监听本机。

### 1. 配置后端

在 `backend/` 下新建 `.env`，填写以下配置；将占位值替换为自己的值：

```dotenv
HOST=127.0.0.1
PORT=3001
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_USERNAME=your-admin-name
ADMIN_PASSWORD=replace-with-a-strong-password
```

可用以下命令生成随机密钥，并将输出填入 `JWT_SECRET`：

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

首次启动时会自动创建 SQLite 数据库、数据表和后端管理员记录，无需手动导入 SQL。`ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 仅在数据库尚无管理员时生效，修改它们不会重置已有记录，也不会修改前端保留的开发登录逻辑。

本地数据默认位于 `backend/db/data/love-museum.sqlite`，上传文件默认位于 `backend/uploads/`。

### 2. 配置前端

在项目根目录新建 `.env.local`：

```dotenv
BACKEND_ORIGIN=http://127.0.0.1:3001
NEXT_PUBLIC_API_URL=/api
```

Next.js 会将 `/api/*` 和 `/uploads/*` 转发给后端。修改后端地址后，需要重启开发服务，生产环境则需要重新构建前端。

当前数据层使用 SQLite，运行项目无需配置 Supabase；仓库中的 `.env.local.example` 是旧版 Supabase 配置示例，不适用于当前部署流程。

### 3. 启动开发服务

终端一，在项目根目录启动 API：

```bash
npm start --prefix backend
```

终端二，在项目根目录启动前端：

```bash
npm run dev -- --hostname 127.0.0.1
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。API 健康检查地址为 [http://127.0.0.1:3001/api/health](http://127.0.0.1:3001/api/health)，正常时返回 `status: "ok"`。

### 4. 构建并运行 Web 生产版本

完成上述配置后，在项目根目录构建：

```bash
npm run build
```

保持后端运行，在另一个终端启动生产前端：

```bash
npm run start -- --hostname 127.0.0.1 --port 3000
```

长期运行时，可用 systemd 或其他进程管理工具分别托管前端、后端；两者的工作目录均可设为项目根目录，启动命令分别为上面的 `npm run start ...` 和 `npm start --prefix backend`。受保护的访问网关应将请求转发到 `127.0.0.1:3000`，API 端口 `3001` 保持仅本机可访问。

服务器部署应将数据库与上传目录放在持久化磁盘上，可在 `backend/.env` 中额外设置绝对路径：

```dotenv
DB_PATH=/srv/evermore-data/love-museum.sqlite
UPLOAD_DIR=/srv/evermore-data/uploads
```

以上为 Linux 路径示例，服务账号需要有对应目录的读写权限。更新代码时保留数据目录和原有 `JWT_SECRET`，安装依赖、重新构建并重启两个服务即可。

此方式依赖常驻 Node.js 进程和可写的持久化目录，GitHub Pages 等纯静态托管不能直接运行完整应用。浏览器模式下，桌面文件夹选择、桌面更新和对象存储同步等能力不等同于桌面版；上述 Web 配置默认不开启对象存储同步。

## 对象存储同步

桌面版可在 **设置 → 对象存储连接与数据库同步** 中配置 Endpoint、Region、Bucket、Access Key 和 Secret Key，连接自己的 S3 兼容存储。

- 未配置对象存储时，上传文件保存在本地 `uploads/` 中。
- 配置后，新增照片和视频直接存入对象存储，本机按需下载并缓存，默认缓存上限为 500 MB，可在设置中调整。
- SQLite 数据以快照同步；本机和云端都发生修改时，需要选择保留哪一份，不会自动合并。
- 云端恢复前会在本机保留 `sync-recovery/` 恢复副本。
- 对象前缀为 `love-museum/v1/`，凭据需要桶的读取和写入权限。

凭据加密保存在本机，不随快照上传；快照内容没有额外的端到端加密，请使用私有桶。完整同步说明见 [DESKTOP.md](./DESKTOP.md#s3-compatible-sync)。

## 数据与备份

| 运行方式 | 数据位置 |
| --- | --- |
| 桌面开发 | 项目根目录 `.tauri-dev-data/` |
| Windows 安装版 | 通常为 `%APPDATA%\com.lovemuseum.desktop\`；存在旧版数据时可能继续使用 `%APPDATA%\Love Museum\` |
| Web 模式 | 默认 `backend/db/data/` 和 `backend/uploads/`，或环境变量指定的目录 |

备份前先关闭应用或停止后端，再复制整个数据目录，包括 SQLite 数据库、存在的 `-wal` / `-shm` 文件、`secret.key`、对象存储配置与本地上传文件。Web 模式还需要妥善保存 `backend/.env`。已上传至对象存储的媒体需要单独保留云端备份，本机媒体缓存不能代替它们。

应用沿用旧版 Love Museum 的部分标识、数据库名称与同步前缀，因此数据目录中出现 `love-museum` 属于正常情况。

## 常用命令

以下命令均在项目根目录执行：

| 命令 | 用途 |
| --- | --- |
| `npm run desktop` | 启动桌面开发环境 |
| `npm run dist:win` | 构建 Windows x64 安装包 |
| `npm run build:desktop` | 仅导出桌面前端 |
| `npm run dev` | 启动 Web 前端开发服务 |
| `npm run build` | 构建 Web 生产前端 |
| `npm run start` | 启动 Web 生产前端 |
| `npm start --prefix backend` | 启动独立 API 服务 |
| `npm run test:desktop-api` | 运行后端与本地数据层测试 |

## 项目结构

```text
Evermore/
├── app/              # 页面、布局与全局样式
├── components/       # 界面组件、音乐播放与同步调度
├── lib/              # API 客户端、状态与桌面能力封装
├── types/            # TypeScript 类型
├── backend/          # Express API、SQLite、上传与同步服务
├── scripts/          # 桌面启动、构建与发布脚本
├── src-tauri/        # Tauri 配置与 Rust 桌面入口
└── DESKTOP.md        # 桌面打包、更新签名与数据迁移说明
```
