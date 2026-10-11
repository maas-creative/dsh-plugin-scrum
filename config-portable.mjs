// Scrum's tmux presentation settings; operational pane ownership is host-enforced.
import{z}from'zod';
export const tmuxConfigSchema=z.object({
 enabled:z.boolean().default(false),
 layout:z.enum(['main-horizontal','main-vertical','tiled','even-horizontal','even-vertical']).default('main-vertical'),
 main_pane_size:z.number().int().min(20).max(80).default(60),
 main_pane_min_width:z.number().int().min(40).default(120),
 agent_pane_min_width:z.number().int().min(20).default(40),
 isolation:z.enum(['inline','window','session']).default('inline'),
});
