// Swarm 常量 — 零外部依赖

/** Leader 名称（固定） */
export const TEAM_LEAD_NAME = 'team-lead'

/** 邮箱轮询间隔 (ms) */
export const MAILBOX_POLL_INTERVAL_MS = 500

/** 权限轮询间隔 (ms) */
export const PERMISSION_POLL_INTERVAL_MS = 500

/** 队友消息 UI 上限 */
export const TEAMMATE_MESSAGES_UI_CAP = 50

/** Lock 重试配置 */
export const LOCK_OPTIONS = {
  retries: {
    retries: 10,
    minTimeout: 5,
    maxTimeout: 100,
  },
}

/** 环境变量名 */
export const ENV = {
  TEAM_NAME: 'CLAUDE_CODE_TEAM_NAME',
  TEAMMATE_NAME: 'CLAUDE_CODE_TEAMMATE_NAME',
  TEAMMATE_COLOR: 'CLAUDE_CODE_TEAMMATE_COLOR',
  SESSION_ID: 'CLAUDE_CODE_SESSION_ID',
  PERMISSION_MODE: 'CLAUDE_CODE_PERMISSION_MODE',
  TEAM_ALLOWED_PATHS: 'CLAUDE_CODE_TEAM_ALLOWED_PATHS',
} as const
