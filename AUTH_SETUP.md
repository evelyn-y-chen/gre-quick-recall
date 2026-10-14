# 词笺账号登录配置

GitHub 用户名已改为 `evelyn-y-chen`，分享版网址为：

**https://evelyn-y-chen.github.io/gre-quick-recall/**

代码已接入现有 Supabase 项目 `mzsyfxhvxzdoomfvumxe`，提供 GitHub 和 Google 登录入口。两种方式都不需要 Gmail 发信或应用专用密码。登录供应商仍需完成下列后台配置；配置之前，入口会显示“尚未开放”。邮箱密码入口保留，注册和邮件链接暂未开放。

## 1. GitHub 登录（先完成这个）

在 [New OAuth Application](https://github.com/settings/applications/new) 填写：

| 字段 | 内容 |
| --- | --- |
| Application name | Lemnota · 词笺 |
| Homepage URL | https://evelyn-y-chen.github.io/gre-quick-recall/ |
| Application description | A personal vocabulary journal. Sign in to save your own notes and learning progress across devices. |
| Authorization callback URL | https://mzsyfxhvxzdoomfvumxe.supabase.co/auth/v1/callback |

不勾选 Device Flow。由账号所有者点击 Register application，然后生成 Client secret。将 Client ID 和 secret **直接填到** [Supabase 登录供应商](https://supabase.com/dashboard/project/mzsyfxhvxzdoomfvumxe/auth/providers) 的 GitHub 设置中并启用。不要提交到 GitHub 源码，不要发到聊天里。

如果你已建立词笺 OAuth 应用，只需修改它的 Homepage URL。Supabase 项目未改名，Authorization callback URL 保持不变。原来的 Codex 仓库连接与词笺登录应用用途不同，不能混用。

## 2. 登录返回网址（必须更新）

打开 [Supabase URL Configuration](https://supabase.com/dashboard/project/mzsyfxhvxzdoomfvumxe/auth/url-configuration)：

- Site URL：`https://evelyn-y-chen.github.io/gre-quick-recall/`
- Redirect URLs：添加完全相同的新网址，移除旧 GitHub Pages 网址。
- 本地验证如有需要，另加 `http://localhost:5182/` 与 `http://127.0.0.1:5182/`；不要添加泛域名通配符。

前端根据当前网站地址生成 redirectTo，使用 PKCE 返回并恢复登录。不要把 GitHub Pages 网址误填成 OAuth 的 Supabase callback URL。

## 3. Google 登录（再完成这个）

在 [Google Cloud](https://console.cloud.google.com/) 选择或建立项目，然后进入 [Google Auth Platform](https://console.cloud.google.com/auth/overview)。

1. Branding：应用名称填 `词笺 · Lemnota`；联系邮箱使用自己的邮箱。Google 若要求接受条款、验证账号，由账号所有者完成。
2. Audience：面对普通使用者选择 External。配置测试阶段，将自己要测试的 Google 账号加入 Test users；面向所有使用者前再完成发布所需步骤。
3. Data Access：只使用 `openid`、`userinfo.email`、`userinfo.profile` 三个基础身份范围。无需 Gmail 邮件、通讯录或 Drive 权限。
4. Clients：新建 OAuth Client ID，Application type 选 **Web application**，名称可填 `Lemnota Web`。

| 字段 | 内容 |
| --- | --- |
| Authorized JavaScript origins | https://evelyn-y-chen.github.io |
| Authorized redirect URIs | https://mzsyfxhvxzdoomfvumxe.supabase.co/auth/v1/callback |

由账号所有者生成并将 Client ID、Client secret **直接填到** [Supabase 登录供应商](https://supabase.com/dashboard/project/mzsyfxhvxzdoomfvumxe/auth/providers) 的 Google 设置中，启用并保存。保持 nonce 检查启用。后台未完成之前，Google 按钮保持不可用；完成后重新打开登录弹窗即可读取新配置。

Google Cloud 创建登录应用与 Gmail SMTP 是两件事；这里不用填写日常邮箱密码或 Gmail 应用专用密码。

## 4. 换网址后的学习记录

GitHub 仓库位置已更新，个人网站 `https://gre-quick-recall.cyitong546.chatgpt.site` 不受影响。浏览器本地记录按网站来源隔离，旧 Pages 网址的游客记录不会自动出现在新网址。已有便笺可导入新网址；已经保存到账号的记录仍由同一个 Supabase 用户 ID 管理。

## 5. 真实跨设备验证

1. GitHub 后台启用后，在分享版点击“使用 GitHub 登录”，完成授权并确认返回新网址。
2. 设备 A 修改一个笔记、一个红黄绿标记和一条生词本内容，确认“已保存到账号”。
3. 设备 B 用同一账号登录，确认能读取；B 修改一处，A 点击“读取账号最新进度”核对。
4. 退出账号，应恢复原游客空间；另一个账号不应看到 A 的个人记录。
5. 同时修改时，旧版本上传应提示冲突，并保留本机副本便笺。
6. Google 后台启用后重复以上流程；测试阶段仅用列入 Test users 的账号。

本地测试覆盖账号切换、离线缓存和版本冲突；真实跨设备登录与保存仍待后台凭证配置后验证。

官方参考：[GitHub OAuth](https://supabase.com/docs/guides/auth/social-login/auth-github)、[Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)、[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)。邮箱注册未来如需开放，再配置独立发信服务，不必继续尝试 Gmail 应用专用密码。
