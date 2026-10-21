import type {
  PluginContext,
  SandboxedPlugin,
  SandboxedRouteContext,
} from "emdash/plugin";
import { metadata } from "./services/metadata.js";
import { admin } from "./ui/admin.js";
import { draft, editor } from "./ui/editor.js";

const safe =
  (handler: (r: SandboxedRouteContext, c: PluginContext) => Promise<unknown>) =>
  async (r: SandboxedRouteContext, c: PluginContext): Promise<unknown> => {
    try {
      return await handler(r, c);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The operation could not be completed";
      return {
        blocks: [
          {
            type: "banner",
            variant: "error",
            title: "QuixSEO could not complete this action",
            description: message.slice(0, 1500),
          },
        ],
        toast: {
          type: "error",
          message: "Review the error and reload before retrying.",
        },
      };
    }
  };
const plugin: SandboxedPlugin = {
  hooks: { "page:metadata": metadata },
  routes: {
    admin: { permission: "content:edit_any", handler: safe(admin) },
    editor: { permission: "content:edit_own", handler: safe(editor) },
    draft: { permission: "content:edit_own", handler: draft },
  },
};
export default plugin;
