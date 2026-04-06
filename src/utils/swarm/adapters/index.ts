// src/utils/swarm/adapters — AgentDeps 适配器
// 桥接 src/ 基础设施到 @anthropic/agent 的 AgentDeps 接口
// 用于 in-process 队友的 AgentCore 实例化

export { createSwarmProviderAdapter } from './SwarmProviderAdapter.js'
export { createSwarmToolAdapter } from './SwarmToolAdapter.js'
export { createSwarmPermissionAdapter } from './SwarmPermissionAdapter.js'
export { createSwarmCompactionAdapter } from './SwarmCompactionAdapter.js'
export { createSwarmContextAdapter } from './SwarmContextAdapter.js'
export { createSwarmHookAdapter } from './SwarmHookAdapter.js'
export { createSwarmSessionAdapter } from './SwarmSessionAdapter.js'
export { createSwarmOutputAdapter } from './SwarmOutputAdapter.js'
export { createSwarmMailboxAdapter } from './SwarmMailboxAdapter.js'
export { createSwarmTaskClaimingAdapter } from './SwarmTaskClaimingAdapter.js'
export { buildSwarmDeps } from './buildSwarmDeps.js'
export type { SwarmDepsConfig } from './buildSwarmDeps.js'
