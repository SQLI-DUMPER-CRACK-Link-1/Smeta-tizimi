import { SystemControlCenter } from './SystemControlCenter';
import type { SystemControlData } from '../../components/system-control';

export const SYSTEM_CONTROL_DEMO_DATA: SystemControlData = {
  health: [
    { id: 'database', name: 'Database', status: 'healthy', lastCheck: '2 daqiqa oldin', version: 'schema 2026.09.01', message: 'Kanonik yozuvlar ishlamoqda.' },
    { id: 'drive', name: 'Google Drive', status: 'warning', lastCheck: '5 daqiqa oldin', version: 'Drive API v3', message: 'Bitta reconciliation navbatda.' },
    { id: 'gas', name: 'GAS Bridge', status: 'healthy', lastCheck: '1 daqiqa oldin', version: 'deploy qa-47' },
    { id: 'cloudflare', name: 'Frontend / Cloudflare', status: 'healthy', lastCheck: 'hozir', version: 'web 7f4a91c' },
    { id: 'storage', name: 'Storage', status: 'warning', lastCheck: '4 daqiqa oldin', version: 'storage v1', message: '1 ta obyekt provision qayta urinishi kerak.' },
    { id: 'jobs', name: 'Background Jobs', status: 'failed', lastCheck: '1 daqiqa oldin', version: 'worker queue', message: 'Report generation job xato bilan tugagan.' },
  ],
  capabilities: [
    { id: 'storage-company-bind', module: 'STORAGE', capability: 'Company Storage Bind', status: 'healthy', enabled: 'on', scope: 'company', version: 'v1', lastSuccess: '10:24', dependency: 'Google Drive workspace' },
    { id: 'storage-project', module: 'STORAGE', capability: 'Project Provision', status: 'warning', enabled: 'on', scope: 'project', version: 'v1', lastSuccess: '10:21', lastError: 'Bitta loyiha qayta tekshiruv kutmoqda', dependency: 'Company Storage Bind' },
    { id: 'storage-object', module: 'STORAGE', capability: 'Object Provision', status: 'failed', enabled: 'paused', scope: 'project', version: 'v1', lastError: 'OBJECT_STORAGE_NOT_PROVISIONED', dependency: 'Project Provision' },
    { id: 'storage-document', module: 'STORAGE', capability: 'Document Upload', status: 'healthy', enabled: 'on', scope: 'project', version: 'v1', lastSuccess: '09:58', dependency: 'Object Provision' },
    { id: 'smeta-import', module: 'SMETA', capability: 'Smeta Import', status: 'healthy', enabled: 'on', scope: 'company', version: 'v2', lastSuccess: '09:43', dependency: 'Document Registry' },
    { id: 'f2-export', module: 'F2', capability: 'Document Export', status: 'disabled', enabled: 'read_only', scope: 'global', version: 'v1', dependency: 'F2 Registry' },
    { id: 'rfq', module: 'PROCUREMENT', capability: 'RFQ', status: 'healthy', enabled: 'on', scope: 'company', version: 'v1', lastSuccess: 'Kecha', dependency: 'Material Need' },
    { id: 'ai-estimate', module: 'AI', capability: 'Estimate Assistant', status: 'warning', enabled: 'off', scope: 'global', version: 'beta', lastError: 'Provider sozlanmagan', dependency: 'AI provider' },
  ],
  integrations: [
    { id: 'google-drive', name: 'Google Drive', configured: true, status: 'warning', lastCheck: '5 daqiqa oldin', version: 'API v3', error: 'Reconciliation kutmoqda' },
    { id: 'supabase', name: 'Supabase', configured: true, status: 'healthy', lastCheck: '1 daqiqa oldin', version: 'Postgres' },
    { id: 'gas-bridge', name: 'GAS Bridge', configured: true, status: 'healthy', lastCheck: '1 daqiqa oldin', version: 'qa-47' },
    { id: 'cloudflare', name: 'Cloudflare', configured: true, status: 'healthy', lastCheck: 'hozir', version: 'Pages' },
    { id: 'onec', name: '1C', configured: false, status: 'not_configured' },
    { id: 'didox', name: 'Didox', configured: true, status: 'failed', lastCheck: '20 daqiqa oldin', error: 'Autentifikatsiya yangilanishi talab qilinadi' },
  ],
  jobs: [
    { id: 'job-2041', type: 'Drive Reconciliation', module: 'STORAGE', status: 'running', progress: 62, startedAt: '10:18', duration: '4m 12s', actor: 'system', retryCount: 0 },
    { id: 'job-2039', type: 'Report Generation', module: 'REPORTS', status: 'failed', startedAt: '10:05', duration: '1m 04s', actor: 'admin@demo', retryCount: 2 },
    { id: 'job-2038', type: 'Document Indexing', module: 'STORAGE', status: 'paused', progress: 44, startedAt: '09:54', duration: '8m 12s', actor: 'system', retryCount: 1 },
    { id: 'job-2037', type: 'AI Extraction', module: 'AI', status: 'queued', actor: 'pto@demo', retryCount: 0 },
  ],
  incidents: [
    { id: 'inc-77', severity: 'critical', module: 'INTEGRATION', code: 'DIDOX_AUTH_EXPIRED', message: 'Didox autentifikatsiyasi yangilanishi talab qilinadi.', count: 3, firstSeen: '08:40', lastSeen: '10:14', status: 'open' },
    { id: 'inc-76', severity: 'warning', module: 'STORAGE', code: 'OBJECT_STORAGE_NOT_PROVISIONED', message: 'Obyekt papkasi hali tayyor emas.', count: 1, firstSeen: '09:57', lastSeen: '09:57', status: 'acknowledged' },
    { id: 'inc-75', severity: 'info', module: 'JOBS', code: 'RETRY_SCHEDULED', message: 'Report generation qayta navbatga olindi.', count: 1, firstSeen: '10:07', lastSeen: '10:07', status: 'resolved' },
  ],
  auditEvents: [
    { id: 'audit-1', timestamp: '2026-09-01 10:24:12', actor: 'admin@demo', company: 'ACME Qurilish', project: 'Amfiteatr', action: 'Capability override updated', entity: 'storage-company-bind', oldValue: { state: 'paused' }, newValue: { state: 'on', scope: 'company' }, operationId: 'demo-op-204', source: 'control-center' },
    { id: 'audit-2', timestamp: '2026-09-01 10:18:04', actor: 'system', company: 'ACME Qurilish', project: 'Amfiteatr', action: 'Job started', entity: 'job-2041', oldValue: null, newValue: { status: 'running', progress: 0 }, operationId: 'demo-op-203', source: 'scheduler' },
  ],
  version: { frontendCommit: 'demo-7f4a91c', backendSchemaVersion: 'schema-demo-v1', gasDeploymentVersion: 'qa-47', environment: 'DEMO / local UI harness' },
};

export default function SystemControlDemo() { return <SystemControlCenter data={SYSTEM_CONTROL_DEMO_DATA} demo onToggle={(event) => console.info('demo toggle', event)} onScopeChange={(id, scope) => console.info('demo scope', id, scope)} onKill={(capability) => console.info('demo kill', capability.id)} onRetry={(target) => console.info('demo retry', target)} onPause={(job) => console.info('demo pause', job.id)} onResume={(job) => console.info('demo resume', job.id)} onCancel={(job) => console.info('demo cancel', job.id)} onIntegrationAction={(integration, action) => console.info('demo integration', integration.id, action)} onIncidentAction={(incident, action) => console.info('demo incident', incident.id, action)} />; }
