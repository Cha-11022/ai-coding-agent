import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../config';

interface PermissionRecord {
  key: string;
  action: string;
  granted: boolean;
  permanent: boolean;
  timestamp: string;
}

class AuthManager {
  private sessionPermissions: Map<string, boolean>;
  private permanentPermissions: Map<string, PermissionRecord>;
  private permFile: string;

  constructor() {
    this.sessionPermissions = new Map();
    this.permanentPermissions = new Map();
    this.permFile = path.join(PROJECT_ROOT, '.permissions.json');
    this.loadPermanent();
  }

  private loadPermanent(): void {
    try {
      if (fs.existsSync(this.permFile)) {
        const data = JSON.parse(fs.readFileSync(this.permFile, 'utf-8'));
        if (data.permissions) {
          for (const perm of data.permissions) {
            this.permanentPermissions.set(perm.key, perm);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private savePermanent(): void {
    try {
      const data = {
        permissions: Array.from(this.permanentPermissions.values()),
      };
      const dir = path.dirname(this.permFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.permFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  requestApproval(actionKey: string, actionDescription: string): boolean {
    // Check permanent permissions first
    if (this.permanentPermissions.has(actionKey)) {
      const perm = this.permanentPermissions.get(actionKey)!;
      if (perm.granted) return true;
    }
    // Check session permissions
    if (this.sessionPermissions.has(actionKey)) {
      return this.sessionPermissions.get(actionKey)!;
    }
    // Default: auto-approve for low danger actions, deny for high
    if (actionDescription.includes('delete') || actionDescription.includes('format') || actionDescription.includes('clean')) {
      return false;
    }
    return true;
  }

  grantPermission(key: string, action: string, permanent: boolean = false): void {
    if (permanent) {
      this.permanentPermissions.set(key, {
        key,
        action,
        granted: true,
        permanent: true,
        timestamp: new Date().toISOString(),
      });
      this.savePermanent();
    } else {
      this.sessionPermissions.set(key, true);
    }
  }

  revokePermission(key: string): void {
    this.sessionPermissions.delete(key);
    this.permanentPermissions.delete(key);
    this.savePermanent();
  }

  listPermissions(): { session: Record<string, boolean>; permanent: PermissionRecord[] } {
    const session: Record<string, boolean> = {};
    this.sessionPermissions.forEach((value, key) => { session[key] = value; });
    return {
      session,
      permanent: Array.from(this.permanentPermissions.values()),
    };
  }
}

const defaultAuthManager = new AuthManager();
export { AuthManager, defaultAuthManager, PermissionRecord };