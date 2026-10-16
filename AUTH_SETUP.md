# 词笺账号登录配置

分享网址：**https://evelyn-y-chen.github.io/gre-quick-recall/**

## 用户名与密码（不需要邮箱）

用户可以直接创建用户名账号；密码由 Supabase Auth 处理。服务端使用随机内部标识关联账号，不给用户发送邮件，也不要求填写邮箱。内部地址位于保留的 `.invalid` 域，仅是 Auth 的实现标识；不要把它当作真实邮箱，也不要关闭项目的邮箱验证。

已有 GitHub 账号：登录后选择顶部「设置用户名登录」，在同一个账号上设置用户名、密码及恢复码，保留原来的云端进度。已绑定用户名的账号不能通过这一入口覆盖密码或恢复码；忘记密码请使用恢复入口。不同账号的学习空间仍相互隔离。

已设置用户名且记得密码时，可从顶部「账号登录方式」验证当前密码，重新生成恢复码，旧码随即失效。忘记密码时先退出账号，再从「登录 / 注册 → 使用恢复码找回账号」设置新密码。

注册／首次绑定／恢复成功后显示恢复码，可下载一份文本文件。恢复码相当于找回账号的凭据，只保存到用户自己选择的位置；后台只保存其校验值。使用恢复码后会生成新的恢复码，旧码失效。没有邮箱且遗失密码和恢复码时，无法用邮件找回；已绑定 GitHub 的用户仍可用原 GitHub 登录，学习记录也可以通过便笺另行备份。

部署顺序：

1. 应用 `supabase/username-auth.sql`，确保账号映射、恢复码校验值和限流表仅允许 `service_role` 访问，客户端不可读写。
2. 部署 `supabase/functions/username-auth/index.ts` 及其依赖。函数执行自己的用户名／密码校验或用户 Bearer token 校验，因此网关的 `verify_jwt` 设为 false；不可因此移除函数内校验。
3. 使用项目自动提供的 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 环境变量。管理员密钥只在函数内使用，不写入网页、源码或日志。
4. 验证注册、重复用户名、登录失败、首次绑定、恢复码轮换及不同用户隔离。通过后将 `community/publicCloud.json` 的 `usernameLoginEnabled` 设为 true 并发布。

浏览器端仍需先保存游客进度，再登录。首次登录新账号不会自动覆盖或导入游客记录；由用户主动选择导入。

服务端限流使用经校验值处理的技术标识，不存原始 IP；限流状态与长期使用统计分开，过期限流状态会清理。恢复会撤销已有刷新会话，但先前签发的 access token 可能仍有效至到期，不承诺即时撤回所有已发 token。

邮箱验证码／SMTP 本轮不启用，`emailRegistrationEnabled=false` 保留。已有邮箱密码账号仍保留登录入口。Google 登录也不会因新增用户名登录自动开放，以下配置仅供后续维护。

## 1. GitHub 登录（已启用，以下为维护参考）

在 [New OAuth Application](https://github.com/settings/applications/new) 填写：

| 字段 | 内容 |
| --- | --- |
| Application name | Lemnota · 词笺 |
| Homepage URL | https://evelyn-y-chen.github.io/gre-quick-recall/ |
| Application description | A personal vocabulary journal. Sign in to save your own notes and learning progress across devices. |
| Authorization callback URL | https://mzsyfxhvxzdoomfvumxe.supabase.co/auth/v1/callback |

不勾选 Device Flow 或 wildcard matching；Expire user access tokens 保持默认勾选。由账号所有者点击 Register application，然后生成 Client secret。将 Client ID 和 secret **直接填到** [Supabase 登录供应商](https://supabase.com/dashboard/project/mzsyfxhvxzdoomfvumxe/auth/providers) 的 GitHub 设置中并启用。不要提交到 GitHub 源码，不要发到聊天里。

如果你已建立词笺 OAuth 应用，只需修改它的 Homepage URL。Supabase 项目未改名，Authorization callback URL 保持不变。原来的 Codex 仓库连接与词笺登录应用用途不同，不能混用。

## 2. 登录返回网址（必须更新）

打开 [Supabase URL Configuration](https://supabase.com/dashboard/project/mzsyfxhvxzdoomfvumxe/auth/url-configuration)：

- Site URL：`https://evelyn-y-chen.github.io/gre-quick-recall/`
- Redirect URLs：添加完全相同的新网址，移除旧 GitHub Pages 网址。
- 本地验证如有需要，另加 `http://localhost:5182/` 与 `http://127.0.0.1:5182/`；不要添加泛域名通配符。

前端根据当前网站地址生成 redirectTo，使用 PKCE 返回并恢复登录。不要把 GitHub Pages 网址误填成 OAuth 的 Supabase callback URL。

## 3. Google 登录（可选，后台尚未启用）

在 [Google Cloud](https://console.cloud.google.com/) 选择或建立项目，然后进入 [Google Auth Platform](https://console.cloud.google.com/auth/overview)。

1. **Branding**：应用名称填 `词笺 · Lemnota`；支持邮箱与开发者联系邮箱填自己的邮箱。账号验证、条款等步骤由账号所有者完成。
2. **Audience**：选择 **External**；测试阶段把自己的 Google 账号加入 **Test users**。开放给其他使用者前，完成控制台要求的发布与验证步骤。
3. **Data Access**：仅选 `openid`、`.../auth/userinfo.email`、`.../auth/userinfo.profile`。
4. **Clients → Create client**：类型选 **Web application**，名称填 `Lemnota Web`，下列两项照填。

| 字段 | 内容 |
| --- | --- |
| Authorized JavaScript origins | https://evelyn-y-chen.github.io |
| Authorized redirect URIs | https://mzsyfxhvxzdoomfvumxe.supabase.co/auth/v1/callback |

5. 点击 **Create**。由账号所有者把生成的 **Client ID** 和 **Client secret** 直接填入 [Supabase 登录供应商](https://supabase.com/dashboard/project/mzsyfxhvxzdoomfvumxe/auth/providers) → **Google**，启用并保存，保持 nonce 检查启用。
6. 重新打开词笺登录弹窗，用 Test users 中的账号完成登录并核对返回网址。供应商启用只代表可以开始实测，不代表登录和保存均已验证。

Client secret 只填到 Supabase 后台；不要发送到聊天、上传截图或提交到源码。Google 登录与 SMTP 分别配置，这里不用填写日常邮箱密码或 Gmail 应用专用密码。配置依据：[Supabase Google 登录文档](https://supabase.com/docs/guides/auth/social-login/auth-google)。

## 4. 换网址后的学习记录

GitHub 仓库位置已更新，个人网站 `https://gre-quick-recall.cyitong546.chatgpt.site` 不受影响。浏览器本地记录按网站来源隔离，旧 Pages 网址的游客记录不会自动出现在新网址。已有便笺可导入新网址；已经保存到账号的记录仍由同一个 Supabase 用户 ID 管理。

## 5. 真实跨设备验证（尚未完成）

1. GitHub 后台启用后，在分享版点击“使用 GitHub 登录”，完成授权并确认返回新网址。
2. 设备 A 修改一个笔记、一个红黄绿标记和一条生词本内容，确认“已保存到账号”。
3. 设备 B 用同一账号登录，确认能读取；B 修改一处，A 点击“读取账号最新进度”核对。
4. 退出账号，应恢复原游客空间；另一个账号不应看到 A 的个人记录。
5. 同时修改时，旧版本上传应提示冲突，并保留本机副本便笺。
6. 用户名登录开放后，用同一用户名在两台设备重复保存和回读。Google 后台启用后也需单独核对。

本地 92 项测试、TypeScript 和生产构建通过，覆盖账号切换、离线缓存和版本冲突；18 项在线 API 验收通过，验证了注册、恢复码、旧会话撤销、进度保存和账号隔离。两个临时测试账号及其学习记录已清理，剩余均为 0。用户名账号迁移和服务端已部署，前端开关已启用；Google 与 SMTP 本轮不配置。实际两台物理设备的人工操作仍待核对。

其他维护参考：[GitHub OAuth](https://supabase.com/docs/guides/auth/social-login/auth-github)、[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)。
