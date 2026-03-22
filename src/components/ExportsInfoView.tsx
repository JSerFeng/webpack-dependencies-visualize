import { Card } from '@arco-design/web-react';
import type React from 'react';
import type {
  SerializedExportInfo,
  SerializedProvidedExports,
  SerializedSpecialExportInfo,
  SerializedUsedExports,
  WebpackModule,
} from '../utils/webpackCompiler';

interface ExportsInfoViewProps {
  module: WebpackModule;
}

const getModuleLabel = (modulePath: string) => {
  const segments = modulePath.replace(/\\/g, '/').split('/');
  return segments[segments.length - 1] || modulePath;
};

const getProvidedSummary = (providedExports: SerializedProvidedExports) => {
  switch (providedExports.kind) {
    case 'unknown':
      return 'No provided info';
    case 'dynamic':
      return 'Runtime-defined export shape';
    case 'list':
      return providedExports.exports.length === 0
        ? 'No named exports'
        : providedExports.exports.join(', ');
  }
};

const getUsedSummary = (usedExports: SerializedUsedExports) => {
  switch (usedExports.kind) {
    case 'unknown':
      return 'Usage is unknown';
    case 'namespace':
      return 'Namespace/object export is used';
    case 'unused':
      return 'No export usage';
    case 'list':
      return usedExports.exports.length === 0
        ? 'Module is used without named exports'
        : usedExports.exports.join(', ');
  }
};

const getUsageTone = (usedState: SerializedExportInfo['usedState']) => {
  switch (usedState) {
    case 'used':
      return 'emerald';
    case 'only-properties-used':
      return 'amber';
    case 'unknown':
      return 'sky';
    case 'no-info':
      return 'slate';
    default:
      return 'graphite';
  }
};

const getProvidedTone = (
  providedState: SerializedExportInfo['providedState'],
) => {
  switch (providedState) {
    case 'provided':
      return 'emerald';
    case 'maybe-provided':
      return 'amber';
    case 'not-provided':
      return 'rose';
    default:
      return 'slate';
  }
};

const getListTone = (value: boolean) => (value ? 'emerald' : 'graphite');

const StatusPill: React.FC<{ label: string; tone: string }> = ({
  label,
  tone,
}) => <span className={`exports-pill exports-pill-${tone}`}>{label}</span>;

const SummaryStat: React.FC<{ label: string; value: string; tone: string }> = ({
  label,
  value,
  tone,
}) => (
  <div className={`exports-summary-stat exports-summary-stat-${tone}`}>
    <div className="exports-summary-label">{label}</div>
    <div className="exports-summary-value">{value}</div>
  </div>
);

const SpecialInfoCard: React.FC<{
  title: string;
  description: string;
  info: SerializedSpecialExportInfo;
}> = ({ title, description, info }) => (
  <Card className="exports-side-card" title={title}>
    <div className="exports-side-description">{description}</div>
    <div className="exports-state-grid">
      <div className="exports-state-item">
        <span className="exports-state-label">provided</span>
        <span className="exports-state-value">{info.providedLabel}</span>
      </div>
      <div className="exports-state-item">
        <span className="exports-state-label">used</span>
        <span className="exports-state-value">{info.usedLabel}</span>
      </div>
      <div className="exports-state-item exports-state-item-full">
        <span className="exports-state-label">rename</span>
        <span className="exports-state-value">{info.renameLabel}</span>
      </div>
    </div>
    <div className="exports-pill-row">
      <StatusPill
        label={info.providedLabel}
        tone={getProvidedTone(info.providedState)}
      />
      <StatusPill label={info.usedLabel} tone={getUsageTone(info.usedState)} />
      {info.isReexport && <StatusPill label="reexport" tone="sky" />}
      {info.terminalBinding && (
        <StatusPill label="terminal binding" tone="amber" />
      )}
    </div>
    {info.target && (
      <div className="exports-target-callout">
        Reexport target:
        <strong>{` ${info.target.moduleLabel}`}</strong>
        {info.target.exportPath ? `.${info.target.exportPath.join('.')}` : ''}
      </div>
    )}
  </Card>
);

const ExportNode: React.FC<{
  exportInfo: SerializedExportInfo;
  depth?: number;
}> = ({ exportInfo, depth = 0 }) => (
  <div
    className="exports-node"
    style={{ ['--exports-depth' as string]: depth }}
  >
    <div className="exports-node-card">
      <div className="exports-node-header">
        <div className="exports-node-heading">
          <div className="exports-node-name-row">
            <span className="exports-node-name">{exportInfo.name}</span>
            <StatusPill
              label={exportInfo.ownership === 'owned' ? 'owned' : 'redirected'}
              tone={exportInfo.ownership === 'owned' ? 'slate' : 'sky'}
            />
            {exportInfo.isReexport && (
              <StatusPill label="reexport" tone="sky" />
            )}
            {exportInfo.terminalBinding && (
              <StatusPill label="terminal binding" tone="amber" />
            )}
            {exportInfo.usedName && exportInfo.usedName !== exportInfo.name && (
              <StatusPill
                label={`used as ${exportInfo.usedName}`}
                tone="amber"
              />
            )}
          </div>
          <div className="exports-node-rename">{exportInfo.renameLabel}</div>
        </div>
        {exportInfo.target && (
          <div className="exports-node-target">
            <span className="exports-node-target-label">target</span>
            <strong>{exportInfo.target.moduleLabel}</strong>
            {exportInfo.target.exportPath
              ? `.${exportInfo.target.exportPath.join('.')}`
              : ''}
          </div>
        )}
      </div>

      <div className="exports-state-grid">
        <div className="exports-state-item">
          <span className="exports-state-label">provided</span>
          <span className="exports-state-value">
            {exportInfo.providedLabel}
          </span>
        </div>
        <div className="exports-state-item">
          <span className="exports-state-label">used</span>
          <span className="exports-state-value">{exportInfo.usedLabel}</span>
        </div>
        <div className="exports-state-item exports-state-item-full">
          <span className="exports-state-label">rename</span>
          <span className="exports-state-value">{exportInfo.renameLabel}</span>
        </div>
      </div>

      {exportInfo.nested && (
        <div className="exports-nested-panel">
          <div className="exports-nested-title">Nested ExportsInfo</div>
          <div className="exports-nested-summary">
            <span>{`provided: ${getProvidedSummary(exportInfo.nested.providedExports)}`}</span>
            <span>{`used: ${getUsedSummary(exportInfo.nested.usedExports)}`}</span>
          </div>
          {exportInfo.nested.exports.length > 0 ? (
            <div className="exports-nested-tree">
              {exportInfo.nested.exports.map((nestedExport) => (
                <ExportNode
                  key={`${exportInfo.name}.${nestedExport.name}`}
                  exportInfo={nestedExport}
                  depth={depth + 1}
                />
              ))}
            </div>
          ) : (
            <div className="exports-empty-hint">
              Nested ExportsInfo exists, but no named nested exports were
              serialized.
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);

const ExportsInfoView: React.FC<ExportsInfoViewProps> = ({ module }) => {
  const exportsInfo = module.exportsInfo;

  if (!exportsInfo) {
    return (
      <Card className="exports-hero-card" title="ExportsInfo">
        <div className="exports-empty-hint">
          This module does not expose serialized ExportsInfo data.
        </div>
      </Card>
    );
  }

  const ownedCount = exportsInfo.exports.filter(
    (exportInfo) => exportInfo.ownership === 'owned',
  ).length;
  const reexportCount = exportsInfo.exports.filter(
    (exportInfo) => exportInfo.isReexport,
  ).length;
  const unusedCount = exportsInfo.exports.filter(
    (exportInfo) => exportInfo.usedState === 'unused',
  ).length;
  const namedExportCount = exportsInfo.exports.length;
  const moduleLabel = getModuleLabel(module.path);

  return (
    <div className="exports-view">
      <Card className="exports-hero-card">
        <div className="exports-hero-header">
          <div>
            <div className="exports-eyebrow">Following active file:</div>
            <h2 className="exports-hero-title">{moduleLabel}</h2>
            <div className="exports-hero-path">{module.path}</div>
          </div>
          <div className="exports-pill-row">
            <StatusPill
              label={exportsInfo.isModuleUsed ? 'module used' : 'module unused'}
              tone={getListTone(exportsInfo.isModuleUsed)}
            />
            <StatusPill
              label={
                exportsInfo.isUsed ? 'has export usage' : 'side-effects only'
              }
              tone={getListTone(exportsInfo.isUsed)}
            />
            {exportsInfo.hasRedirect && (
              <StatusPill label="redirected exports" tone="sky" />
            )}
          </div>
        </div>

        <div className="exports-summary-grid">
          <SummaryStat
            label="named exports"
            value={String(namedExportCount)}
            tone="slate"
          />
          <SummaryStat label="owned" value={String(ownedCount)} tone="slate" />
          <SummaryStat
            label="reexports"
            value={String(reexportCount)}
            tone="sky"
          />
          <SummaryStat
            label="unused"
            value={String(unusedCount)}
            tone="graphite"
          />
        </div>

        <div className="exports-collection-grid">
          <div className="exports-collection-card">
            <div className="exports-collection-label">Provided Exports</div>
            <div className="exports-collection-value">
              {getProvidedSummary(exportsInfo.providedExports)}
            </div>
          </div>
          <div className="exports-collection-card">
            <div className="exports-collection-label">Used Exports</div>
            <div className="exports-collection-value">
              {getUsedSummary(exportsInfo.usedExports)}
            </div>
          </div>
        </div>
      </Card>

      <div className="exports-layout">
        <div className="exports-main-column">
          <Card className="exports-tree-card" title="Named Exports">
            {exportsInfo.exports.length > 0 ? (
              <div className="exports-tree">
                {exportsInfo.exports.map((exportInfo) => (
                  <ExportNode key={exportInfo.name} exportInfo={exportInfo} />
                ))}
              </div>
            ) : (
              <div className="exports-empty-hint">
                No named exports were recorded for this module.
              </div>
            )}
          </Card>
        </div>

        <div className="exports-side-column">
          <SpecialInfoCard
            title="Other exports"
            description="Named exports not explicitly listed in ordered exports fall back here."
            info={exportsInfo.otherExportsInfo}
          />

          <SpecialInfoCard
            title="Side effects only"
            description="This state answers whether webpack keeps the module alive just for side effects."
            info={exportsInfo.sideEffectsOnlyInfo}
          />
        </div>
      </div>
    </div>
  );
};

export default ExportsInfoView;
