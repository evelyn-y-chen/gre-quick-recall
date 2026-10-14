# 词笺 · Lemnota 项目进度

更新日期：2026-10-14

分享网址：https://evelyn-y-chen.github.io/gre-quick-recall/

| 项目 | 当前状态 |
| --- | --- |
| GitHub 用户名与仓库链接 | 已更新为 evelyn-y-chen |
| GitHub Pages 网站 | 已发布 |
| GitHub 登录 | 已确认 Supabase 供应商启用；按钮根据后台状态开放 |
| 账号学习空间 | 同步逻辑已实现，游客与账号分别保存 |
| 断网与版本冲突 | 本机副本、版本检查和冲突备份已实现，并通过本地测试 |
| 便笺导入导出 | 可用，保留作为额外备份与游客换设备的方式 |
| 真实跨设备保存验证 | 待完成；不能仅凭启用登录按钮视为通过 |
| Google 登录 | 入口代码保留，后台未启用；按作者安排暂缓 |
| 邮箱注册、邮件链接 | 暂未开放，无需继续配置 Gmail 应用专用密码 |
| 个人网站 | 保留原有上传到所有设备功能，与分享版账号空间独立 |

## 下次继续时

1. 用 GitHub 登录分享版，确认返回新网址。
2. 设备 A 保存一个笔记、一个红黄绿标记和一条生词本记录，核对“已保存到账号”。
3. 设备 B 用同一账号读取；B 修改后，A 读取账号最新进度核对。
4. 核对退出账号恢复游客记录、不同账号不串数据，以及并发修改的冲突提示。
5. 有时间再继续 Google 登录配置；今天不需要新注册服务或购买套餐。

本地检查：19 项测试、TypeScript 检查和生产构建通过。真实跨设备验证不在这份本地结果内。

## Status in English

GitHub sign-in is enabled in Supabase. Account workspace synchronization, offline caches, and conflict backups are implemented and locally tested. Actual cross-device saving still needs verification. Google setup is on hold; email registration remains unavailable. The personal website keeps its existing cloud-save behavior.

本次更新：中文释义放大、操作提示增强、新便笺 App 图标；匿名使用统计与管理员汇总后台已接入（默认关闭）；个人版增加分享版兼容便笺导出。Google 登录仍暂缓，账号跨设备保存验证仍待完成。
