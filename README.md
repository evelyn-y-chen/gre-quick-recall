# GRE 速刷 · 分享版

这是与原有私人 Sites 项目分离的网页/PWA 项目。GitHub 仓库为 cyitong546-sudo/gre-quick-recall；已连接 gre-vocabulary Supabase 项目。网页是否上线以 GitHub Pages 部署结果为准，应用商店上架尚未完成。

## 本地启动

需要 Node.js 24。

```sh
npm ci
npm run dev
npm test
npm run build
```

内置的 publicCloud.json 仅含公开客户端配置，可用环境变量覆盖。游客体验中：所有学习数据保留在页面内存，刷新/关闭后丢失。浏览器只在配置登录服务后由 Supabase 保存登录会话，学习数据不进入 localStorage。

## 发布到 cyitong546-sudo 的 GitHub Pages

1. 在 GitHub 建立 `gre-quick-recall` 仓库。只上传本项目，不上传原私人网站的数据库、凭证或运行目录。
2. 将代码推送 main。仓库 Settings → Pages → Source 选择 GitHub Actions。
3. `.github/workflows/pages.yml` 自动测试、构建、发布。部署成功后以 Actions 输出的网址为准；未成功前不能把预期 URL 当作已上线地址。
4. 当前工作流的 BASE_PATH 是 `/gre-quick-recall/`，自定义域名时改为 `/`。
5. GitHub Pages 的可用性取决于仓库可见性和账号套餐；如果要保留私有源码，可将相同 `dist` 部署到支持静态托管的服务。

## 配置邮箱验证码登录

1. 登录 https://supabase.com/dashboard ，创建自己的项目。数据库密码只在 Supabase 输入并妥善保存。
2. 打开 SQL Editor，执行 `supabase/schema.sql`。它建立个人工作区表、RLS 和按登录身份保存的函数。
3. Authentication → Email Templates → Magic Link，邮件正文包含 `{{ .Token }}`，例如 `你的 GRE 速刷登录验证码：{{ .Token }}`。默认模板通常发送链接，本网站使用输入验证码模式。
4. Authentication 中开放 Email provider。正式面向其他用户前配置自己的 SMTP 发信服务；默认邮件服务不能当作对所有访客可用的生产邮件服务。
5. 项目设置取得 Project URL 和 publishable/anon key。本项目只接受公开客户端 key，绝不能填写 service_role、数据库密码或 secret key。
6. 本机复制 `.env.example` 为 `.env.local` 填入两个字段。GitHub Settings → Secrets and variables → Actions → Variables 设置 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`，重新运行部署。
7. 在测试项目先运行 `supabase/isolation-test.sql`（整段事务最终回滚），再使用两个真实账号验证：A 的笔记/颜色不出现在 B；退出后游客为空；两台设备同时编辑会提示冲突；邮件接收和验证码有效。

官方文档：
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://vite.dev/guide/static-deploy.html#github-pages

## 数据与隔离设计

- 原始词库随静态资源分发；私人网站云端的笔记、学习进度、用户信息未拷贝。
- 每个浏览器学习空间使用独立的内存 SQLite，兼容原有词库、笔记和测试逻辑。
- 所有学习记录与配色组成一份 JSON 工作区；认证用户通过 RPC 按 `auth.uid()` 保存。数据库拒绝匿名写入，不能传入他人的 user_id。
- 云端使用 revision 做条件更新。冲突停止自动保存，要求备份后重新载入，不会静默覆盖。
- 游客登录新账号后，可选择保存体验。已存在账号不被游客覆盖，体验可另行下载。
- 本版采用整份工作区同步；大量用户/超大个人笔记需要进一步拆分逐条同步。单份工作区限制 15 MB，失败时保留本次页面内容并提示备份。
- 笔记可以先编辑多个，再在原模块保存至当前工作区；顶部状态表示整份工作区是否已同步到账号。
- 账号数据备份可下载；备份恢复界面、原私人账号迁移和账号删除入口尚未实现，正式发布前应完成所需的数据管理流程。

## App

已有 PWA manifest、图标、主屏幕安装提示。生产需 HTTPS。当前缓存静态资源，不承诺整站离线或离线登录。Android/iOS 商店发布尚未制作签名包；需开发者账号、应用资料和各商店审核。

## 验证与已知边界

`npm test` 检查游客清空、独立工作区和陈旧编辑冲突。真实 Supabase RLS、验证码送达和跨设备同步必须在项目配置后验证，不能用前端测试代替。

词库文本与词典保持各自来源说明；ECDICT 授权在 `public/dictionary-v1/LICENSE.txt`。本仓库未擅自给第三方词库授予新的开源许可证。
