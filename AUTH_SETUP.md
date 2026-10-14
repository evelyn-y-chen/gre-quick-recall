# 词笺账号登录配置

代码已接入现有 Supabase 项目 `mzsyfxhvxzdoomfvumxe`。GitHub 登录尚未启用；邮箱注册仍待自定义 SMTP。下面不包含任何密码或密钥。

## 1. GitHub 登录应用

在 [New OAuth Application](https://github.com/settings/applications/new) 填写：

| 字段 | 内容 |
| --- | --- |
| Application name | Lemnota · 词笺 |
| Homepage URL | https://cyitong546-sudo.github.io/gre-quick-recall/ |
| Application description | A personal vocabulary journal. Sign in to save your own notes and learning progress across devices. |
| Authorization callback URL | https://mzsyfxhvxzdoomfvumxe.supabase.co/auth/v1/callback |

不勾选 Device Flow。由账号所有者点击 Register application，然后生成 Client secret。将 Client ID 和 secret **直接填到** [Supabase 登录供应商](https://supabase.com/dashboard/project/mzsyfxhvxzdoomfvumxe/auth/providers) 的 GitHub 设置中并启用。不要提交到 GitHub 源码，不要发到聊天里。

词笺请求基础身份和邮箱权限，不请求仓库权限。OAuth 应用与原来的 Codex 仓库连接是两个不同用途的应用。

## 2. 登录返回网址

打开 [Supabase URL Configuration](https://supabase.com/dashboard/project/mzsyfxhvxzdoomfvumxe/auth/url-configuration)：

- Site URL：`https://cyitong546-sudo.github.io/gre-quick-recall/`
- Redirect URLs：添加完全相同的分享版网址。
- 本地验证如有需要，另外添加 `http://localhost:5182/` 与 `http://127.0.0.1:5182/`；不要添加泛域名通配符。

保留邮箱验证，不关闭确认流程。页面使用 PKCE，邮件链接应在发起请求的浏览器里打开。

## 3. 用 Gmail 发验证邮件

使用你自己的 Gmail 发信邮箱。由本人确认已开启两步验证，再在 [Google 应用专用密码](https://myaccount.google.com/apppasswords) 创建一个名为 `Lemnota Supabase SMTP` 的密码。

在 [Supabase SMTP](https://supabase.com/dashboard/project/mzsyfxhvxzdoomfvumxe/auth/smtp) 开启自定义 SMTP 并填写：

| 字段 | 内容 |
| --- | --- |
| Sender email | 你的 Gmail 地址 |
| Sender name | 词笺 · Lemnota |
| Host | smtp.gmail.com |
| Port | 465 |
| Username | 同一个 Gmail 地址 |
| Password | 本人生成的应用专用密码；不是日常 Gmail 密码 |

应用专用密码只填写在 Supabase 后台。无需改源码里的公开项目 key，也不能把 SMTP 密码放进 VITE 环境变量或公共配置。

SMTP 保存后，先在本地把 `community/publicCloud.json` 的 `emailRegistrationEnabled` 改为 `true`，用自己的邮箱进行实际注册 / 登录验证。验证通过后再部署这个开关；这是公开的功能开关，不是凭证。

官方参考：[Supabase GitHub OAuth](https://supabase.com/docs/guides/auth/social-login/auth-github)、[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)、[Google 应用专用密码](https://support.google.com/accounts/answer/185833)。Gmail 适合当前小规模验证；若使用量增加，可再换独立发信服务。

## 4. 真实跨设备验证

1. 设备 A 登录，修改一个笔记、一个红黄绿标记和一条生词本内容，确认“已保存到账号”。
2. 设备 B 用相同账号登录，确认能读取这些记录。
3. B 修改一处，A 点击“读取账号最新进度”核对。
4. 退出账号，应恢复原游客空间；另一个账号不应看到 A 的个人记录。
5. 两个设备同时修改时，旧版本上传应提示冲突，并保留本机副本便笺。

本地测试与只读权限核查已经覆盖空账号、离线缓存、版本冲突等逻辑。真实项目写入测试被自动审批拒绝，未执行；仍需完成以上本人登录验证。
