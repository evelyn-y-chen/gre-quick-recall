# 词笺 · Lemnota 项目进度

更新日期：2026-10-16

分享网址：https://evelyn-y-chen.github.io/gre-quick-recall/

| 项目 | 当前状态 |
| --- | --- |
| GitHub 用户名与仓库链接 | 已更新为 evelyn-y-chen |
| GitHub Pages 网站 | 已发布 |
| GitHub 登录 | 已确认 Supabase 供应商启用；按钮根据后台状态开放 |
| 账号学习空间 | 同步逻辑已实现，游客与账号分别保存 |
| 断网与版本冲突 | 本机副本、版本检查和冲突备份已实现，并通过本地测试 |
| 便笺导入导出 | 可用，保留作为额外备份与游客换设备的方式 |
| 反馈与作者回复 | 游客提交公开建议；登录可选公开／私人，默认私人；作者从统计后台回复，旧反馈保持私人 |
| 真实跨设备保存验证 | 待完成；不能仅凭启用登录按钮视为通过 |
| Google 登录 | 入口保留，后台尚未启用；本轮优先无需邮箱的用户名登录 |
| 用户名与密码登录 | 界面、服务端与恢复码已实现；后台已部署，公众开关关闭，待在线验收 |
| Supabase 邮箱供应商 | external.email=true；供应商开启不代表已具备公众发信能力 |
| 邮箱密码登录 | 仅保留已有账号入口；新用户改用用户名注册 |
| 个人网站 | 保留原有上传到所有设备功能，与分享版账号空间独立 |

## 下次继续时

1. 用 GitHub 登录分享版，确认返回新网址。
2. 设备 A 保存一个笔记、一个红黄绿标记和一条生词本记录，核对“已保存到账号”。
3. 设备 B 用同一账号读取；B 修改后，A 读取账号最新进度核对。
4. 核对退出账号恢复游客记录、不同账号不串数据，以及并发修改的冲突提示。
5. 获准后创建两个临时用户名账号，验证注册、恢复、保存与隔离，立即清理临时账号及其记录。
6. 验收通过后开放 usernameLoginEnabled 并发布；本轮不配置 Google 或 SMTP。

本地检查：92 项测试、TypeScript 检查和生产构建通过。真实跨设备验证不在这份本地结果内。

## Status in English

GitHub sign-in is enabled in Supabase. Username/password registration, linking and recovery-code flows are implemented and locally tested. The server is deployed, but the public usernameLoginEnabled gate remains false pending live checks and publication. Google and email registration remain disabled; SMTP is not being configured in this update. Account workspace synchronization, offline caches, and conflict backups are locally tested; actual cross-device saving still needs verification. Existing password accounts retain their email/password sign-in option. The personal website keeps its existing cloud-save behavior. Guest feedback is public; signed-in users can choose public or private feedback, with private selected by default. Private messages remain between their submitting account and the author, and older messages stay private.

此前更新：中文释义放大、操作提示增强、新便笺 App 图标；使用统计与管理员汇总后台已接入，进入学习前明确同意，统计长期保留；个人版增加分享版兼容便笺导出。账号跨设备保存验证仍待完成；Google 与邮箱的最新状态见下方 2026-10-16 记录。

前轮更新：统计新增「全部」及所选范围汇总；新增账号私密反馈和作者回复。数据库事务验证通过：用户隔离、管理员权限、重复提交幂等、回复回读及全部范围查询。首页提供账号同步与便笺模式两种入口；使用指南中英文完整覆盖各模块、生词本与红绿灯自测。真实跨设备人工验证仍待完成。

两步等价词测试新增释义错误短路：A+ 完整测试、A+/BB 双向测试均跳过第二步，直接解析；不产生未作答的漏选记录，连续正确与长期复习逻辑仍保留。

新增「我的进步」：词数去重，优先展示自测熟悉词，按练习量排列前三板块；保存完成测试轮次。测试改为适配视窗的专注布局，长解析、笔记单独滚动。

验证更新：30 项自动测试通过，覆盖释义错误跳步、返场连续正确、个人进步去重/排序/空间隔离、账号离线冲突等；反馈数据库权限与回读使用事务测试验证并已回滚测试数据。完整需求核对见 REQUIREMENTS_REVIEW.md。

2026-10-15 反馈范围更新：未登录可以直接提交公开建议；登录后可选公开或私人，默认私人。公开内容与作者回复所有人可见，页面不展示账号身份；私人内容与回复仅本人和作者可见。已有反馈保持私人，不自动转为公开。中英文指南与 README 同步说明；回复仍在应用内查看，不发送邮件通知。

### 本轮验证：公开／私人反馈与 A+ 统一词卡

- 游客直接提交公开建议；登录用户默认私人，可主动选择公开；作者回复沿用原反馈可见范围。旧接口及旧反馈保持私人。
- 33 项自动测试、TypeScript 检查与 GitHub Pages 路径生产构建通过。数据库回归包含真实匿名角色提交、账号隔离、公开／私人回复、权限和幂等重试；测试数据均已回滚。
- 反馈窗口检查了 390px 手机宽度，无横向溢出；A+ 卡片在手机、平板和电脑使用一致宽度，单词不换行。
- 安全扫描提示反馈表为 RPC-only（已撤销直接访问），新 RPC 的匿名／登录执行权限为本功能所需，已核查函数内权限。既有项目的其他安全提示未在本轮调整。

### 2026-10-15 使用指南与资料来源说明

- 使用指南按开始使用、词库与资料、复习测试、保存设置及反馈隐私组织，提供中英文操作说明。
- 补充 A+ 与 GLEE必备1500词的公开视频学习提示，可按课程或词表名称自行搜索；BB六选二的记法来自上、中、下三份 PDF 原资料，不归为视频笔记。
- 明确默认笔记主要根据公开视频整理、去重与简化；GLEE 从 List 22（含）起的后续笔记由 AI 整理，原因是整理时老师的视频尚未覆盖该部分。
- 登录供应商的实际开放状态不因文案更新而改变。

本轮指南验证：中英文界面切换及来源段落已在浏览器核对，TypeScript 检查与生产构建通过。仅更新说明文案与组织结构，未更改学习记录、笔记或登录开放状态。

### 2026-10-15 来源订正与双向测试复习计划

- 全能词速刷、等价词速刷明确标注青山学堂来源；此来源不指 A+。填空高频3000词的面向用户说明统一为「网络资源整理」。
- 公开视频提示仅指 A+ 与 GLEE；BB六选二记忆方法来自三份 PDF。GLEE 从 List 22（含）起的 AI 整理说明保留。
- 全能词、A+、BB 双向测试的说明已加入独立到期计划：1、2、4、7、15、30 天，之后每 30 天；错／不确定次日重启，同日重复正确不升级，旧已测词日期未知时今天到期。原 A+ 完整测试计划独立保留。
- 以上复习计划正在实现与验证，发布状态及实际验证结果以本轮后续记录为准。

Source corrections: General vocabulary and Equivalent pairs come from 青山学堂 (Qingshan Xuetang); Cloze high-frequency 3000 is described as compiled from online resources. Video study references apply to A+ and GLEE, not BB. BB memory methods come from the original three PDF volumes. GLEE notes from List 22 onward retain their AI-organized designation. Independent two-way-test review schedules for General vocabulary, A+ and BB are implemented. Model and component tests verify next-day resets, same-day limits, legacy migration and workspace isolation. The existing full A+ test keeps its separate schedule.

本轮验证完成：51 项自动测试通过，TypeScript 检查及生产构建通过。浏览器核对 390px 手机与 768px 平板的到期入口、BB 释义未答对直接解析、错误重置次日、全能词正确后推进间隔及关闭重开保存；原答题页底部操作区仍留在视窗内。新增到期列表长英文词沿用不换行、按可用宽度缩字号的规则。

### 2026-10-16 用户名与密码（无需邮箱）

- 改为用户名注册、登录及恢复码找回。为已有 GitHub 账号添加用户名时保留原 user ID 和云端进度；登录且验证当前密码后可重新生成恢复码。
- 密码由 Supabase Auth 管理，用户名映射、恢复码校验值和限流状态仅服务端可访问。未关闭邮箱验证；内部随机 `.invalid` 标识不是用户邮箱。
- 注册、绑定和恢复后要求保存恢复码；跨标签切换账号时清除旧输入，防止旧请求覆盖新学习空间。
- 92 项自动测试、TypeScript、生产构建通过；数据库权限及限流断言通过并回滚测试数据，390px 手机和 768px 平板表单无横向溢出。
- 后台迁移及 username-auth v1 已部署，公众开关仍关闭。在线烟测因自动审批指出缺少外部测试数据清理而未执行；现等待授权临时创建并立即清理两个测试账号。尚未发布本轮网页改动。
