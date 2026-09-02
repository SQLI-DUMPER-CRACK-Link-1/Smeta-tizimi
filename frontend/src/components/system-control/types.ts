export type SystemStatus = 'healthy' | 'warning' | 'failed' | 'disabled' | 'configured' | 'not_configured';
export type CapabilityState = 'on' | 'off' | 'paused' | 'read_only';
export type CapabilityScope = 'global' | 'company' | 'project';
export type JobStatus = 'queued' | 'running' | 'success' | 'failed' | 'paused' | 'cancelled';
export type IncidentSeverity = 'info' | 'warning' | 'error' | 'critical';
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';

export type SystemHealth = {
  id: string; name: string; status: SystemStatus; lastCheck?: string | null;
  version?: string | null; message?: string | null;
};

export type SystemCapability = {
  id: string; module: string; capability: string; status: SystemStatus;
  enabled: CapabilityState; scope: CapabilityScope; version?: string | null;
  lastSuccess?: string | null; lastError?: string | null; dependency?: string | null;
};

export type CapabilityOverride = {
  capabilityId: string; scope: CapabilityScope; state: CapabilityState;
  companyId?: string | null; projectId?: string | null;
};

export type IntegrationHealth = {
  id: string; name: string; configured: boolean; status: SystemStatus;
  lastCheck?: string | null; version?: string | null; error?: string | null;
};

export type SystemJob = {
  id: string; type: string; module: string; status: JobStatus; progress?: number | null;
  startedAt?: string | null; duration?: string | null; actor?: string | null; retryCount?: number;
};

export type SystemIncident = {
  id: string; severity: IncidentSeverity; module: string; code: string; message: string;
  count: number; firstSeen?: string | null; lastSeen?: string | null; status: IncidentStatus;
};

export type SystemAuditEvent = {
  id: string; timestamp: string; actor?: string | null; company?: string | null;
  project?: string | null; action: string; entity: string; oldValue?: unknown;
  newValue?: unknown; operationId?: string | null; source?: string | null;
};

export type SystemVersionInfo = {
  frontendCommit?: string | null; backendSchemaVersion?: string | null;
  gasDeploymentVersion?: string | null; environment?: string | null;
};

export type SystemControlData = {
  health: SystemHealth[]; capabilities: SystemCapability[]; integrations: IntegrationHealth[];
  jobs: SystemJob[]; incidents: SystemIncident[]; auditEvents: SystemAuditEvent[];
  version: SystemVersionInfo;
};

export type SystemControlCallbacks = {
  onToggle?: (override: CapabilityOverride) => void;
  onScopeChange?: (capabilityId: string, scope: CapabilityScope) => void;
  onKill?: (capability: SystemCapability) => void;
  onRetry?: (target: { type: 'capability' | 'integration' | 'job' | 'incident'; id: string }) => void;
  onPause?: (job: SystemJob) => void;
  onResume?: (job: SystemJob) => void;
  onCancel?: (job: SystemJob) => void;
  onIntegrationAction?: (integration: IntegrationHealth, action: 'configure' | 'test' | 'reconnect' | 'retry') => void;
  onIncidentAction?: (incident: SystemIncident, action: 'details' | 'acknowledge' | 'retry') => void;
};
