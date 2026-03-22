import { Card, Tooltip } from '@arco-design/web-react';
import type React from 'react';
import type {
  SerializedConnectionSide,
  SerializedModuleGraphConnection,
  WebpackModule,
} from '../utils/webpackCompiler';
import styles from './ModuleGraphConnectionViev.module.css';

interface ModuleGraphConnectionViewProps {
  module: WebpackModule;
  onHoverOutgoingConnection: (
    connection: SerializedModuleGraphConnection,
  ) => void;
  onLeaveOutgoingConnection: () => void;
  onSelectOutgoingConnection: (
    connection: SerializedModuleGraphConnection,
  ) => void;
}

type PillTone = 'emerald' | 'amber' | 'sky' | 'rose' | 'slate' | 'graphite';

type ConnectionGroup = {
  key: string;
  title: string;
  description: string;
  connections: SerializedModuleGraphConnection[];
};

const getModuleLabel = (modulePath: string) => {
  const segments = modulePath.replace(/\\/g, '/').split('/');
  return segments[segments.length - 1] || modulePath;
};

const getActiveStateTone = (
  activeState: SerializedModuleGraphConnection['activeState'],
): PillTone => {
  switch (activeState) {
    case 'active':
      return 'emerald';
    case 'transitive-only':
      return 'amber';
    case 'circular-connection':
      return 'sky';
    default:
      return 'graphite';
  }
};

const getBooleanTone = (value: boolean): PillTone =>
  value ? 'emerald' : 'graphite';

const formatActiveState = (
  activeState: SerializedModuleGraphConnection['activeState'],
) => {
  switch (activeState) {
    case 'active':
      return 'active';
    case 'transitive-only':
      return 'transitive only';
    case 'circular-connection':
      return 'circular connection';
    default:
      return 'inactive';
  }
};

const getConnectionSortWeight = (
  connection: SerializedModuleGraphConnection,
): number => {
  switch (connection.activeState) {
    case 'active':
      return 0;
    case 'transitive-only':
      return 1;
    case 'circular-connection':
      return 2;
    default:
      return 3;
  }
};

const sortConnections = (
  left: SerializedModuleGraphConnection,
  right: SerializedModuleGraphConnection,
) => {
  const stateWeight =
    getConnectionSortWeight(left) - getConnectionSortWeight(right);
  if (stateWeight !== 0) {
    return stateWeight;
  }

  const leftRequest =
    left.request ??
    left.dependencyType ??
    left.target.current?.moduleLabel ??
    left.origin.current?.moduleLabel ??
    '';
  const rightRequest =
    right.request ??
    right.dependencyType ??
    right.target.current?.moduleLabel ??
    right.origin.current?.moduleLabel ??
    '';

  return leftRequest.localeCompare(rightRequest);
};

const groupOutgoingConnections = (
  connections: SerializedModuleGraphConnection[],
): ConnectionGroup[] => {
  const groups = new Map<string, ConnectionGroup>();

  for (const connection of connections) {
    const targetPath =
      connection.target.current?.modulePath ??
      connection.target.resolved?.modulePath ??
      'unknown-target';
    const targetLabel =
      connection.target.current?.moduleLabel ??
      connection.target.resolved?.moduleLabel ??
      'Unknown target';
    const group = groups.get(targetPath);

    if (group) {
      group.connections.push(connection);
      continue;
    }

    groups.set(targetPath, {
      key: targetPath,
      title: targetLabel,
      connections: [connection],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      connections: [...group.connections].sort(sortConnections),
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
};

const groupIncomingConnections = (
  connections: SerializedModuleGraphConnection[],
): ConnectionGroup[] => {
  const groups = new Map<string, ConnectionGroup>();

  for (const connection of connections) {
    const key =
      connection.kind === connection.origin.current?.modulePath ??
        connection.origin.resolved?.modulePath ??
        'Unknown origin';
    const title = connection.origin.current?.moduleLabel ??
      connection.origin.resolved?.moduleLabel ??
      'Unknown origin';
    const group = groups.get(key);

    if (group) {
      group.connections.push(connection);
      continue;
    }

    groups.set(key, {
      key,
      title,
      connections: [connection],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      connections: [...group.connections].sort(sortConnections),
    }))
    .sort((left, right) => {
      return left.title.localeCompare(right.title);
    });
};

const StatusPill: React.FC<{ label: string; tone: PillTone }> = ({
  label,
  tone,
}) => <span className={`exports-pill exports-pill-${tone}`}>{label}</span>;

const SummaryStat: React.FC<{
  label: string;
  value: string;
  tone?: PillTone;
}> = ({ label, value, tone = 'slate' }) => (
  <div className={`connections-summary-stat connections-summary-stat-${tone}`}>
    <div className="connections-summary-label">{label}</div>
    <div className="connections-summary-value">{value}</div>
  </div>
);

const ResolutionRow: React.FC<{
  title: string;
  side: SerializedConnectionSide;
}> = ({ title, side }) => {
  if (!side.changedByResolution) {
    return null;
  }

  return (
    <div className="connections-resolution-row">
      <span className="connections-resolution-title">{title}</span>
      <div className="connections-resolution-values">
        <span>{side.current?.moduleLabel ?? 'none'}</span>
        <span className="connections-resolution-arrow">→</span>
        <span>{side.resolved?.moduleLabel ?? 'none'}</span>
      </div>
    </div>
  );
};

const ConnectionCard: React.FC<{
  connection: SerializedModuleGraphConnection;
  direction: 'incoming' | 'outgoing';
  activeModuleLabel: string;
  onHover?: (connection: SerializedModuleGraphConnection) => void;
  onLeave?: () => void;
  onSelect?: (connection: SerializedModuleGraphConnection) => void;
}> = ({
  connection,
  direction,
  activeModuleLabel,
  onHover,
  onLeave,
  onSelect,
}) => {
  const isInteractive = direction === 'outgoing' && Boolean(connection.loc);
  const routeSource =
    direction === 'outgoing'
      ? activeModuleLabel
      : connection.origin.current?.moduleLabel ??
        connection.origin.resolved?.moduleLabel ??
        'unknown origin';
  const routeTarget =
    direction === 'outgoing'
      ? (connection.target.current?.moduleLabel ??
        connection.target.resolved?.moduleLabel ??
        'unknown target')
      : activeModuleLabel;
  const requestLabel = connection.request ?? 'No request';
  const dependencyTypeLabel = connection.dependencyType ?? 'No dependency type';
  const dependencyCategoryLabel =
    connection.dependencyCategory ?? 'No category';

  const cardProps = isInteractive
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onMouseEnter: () => onHover?.(connection),
        onMouseLeave: onLeave,
        onClick: () => onSelect?.(connection),
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect?.(connection);
          }
        },
      }
    : {};

  return (
    <div
      className={`connections-card ${isInteractive ? 'connections-card-interactive' : ''}`}
      {...cardProps}
    >
      <div className="connections-card-top">
        <div className="connections-route-block">
          <div className="connections-route-label">
            {direction === 'outgoing' ? 'source -> target' : 'origin -> target'}
          </div>
          <div className="connections-route">
            <span>{routeSource}</span>
            <span className="connections-route-arrow">→</span>
            <span>{routeTarget}</span>
          </div>
        </div>
        <div className="exports-pill-row">
          <StatusPill
            label={formatActiveState(connection.activeState)}
            tone={getActiveStateTone(connection.activeState)}
          />
          {connection.conditional && (
            <StatusPill label="conditional" tone="sky" />
          )}
          {connection.weak && <StatusPill label="weak" tone="amber" />}
        </div>
      </div>

      <div className="connections-meta-grid">
        <div className="connections-meta-item">
          <span className="connections-meta-label">dependency type</span>
          <span className="connections-meta-value">{dependencyTypeLabel}</span>
        </div>
        <div className="connections-meta-item">
          <span className="connections-meta-label">category</span>
          <span className="connections-meta-value">
            {dependencyCategoryLabel}
          </span>
        </div>
        <div className="connections-meta-item">
          <span className="connections-meta-label">request</span>
          <span className="connections-meta-value">{requestLabel}</span>
        </div>
        <div className="connections-meta-item">
          <span className="connections-meta-label">is active</span>
          <span className="connections-meta-value">
            <StatusPill
              label={connection.isActive ? 'true' : 'false'}
              tone={getBooleanTone(connection.isActive)}
            />
          </span>
        </div>
        <div className="connections-meta-item">
          <span className="connections-meta-label">is target active</span>
          <span className="connections-meta-value">
            <StatusPill
              label={connection.isTargetActive ? 'true' : 'false'}
              tone={getBooleanTone(connection.isTargetActive)}
            />
          </span>
        </div>
      </div>

      {(connection.origin.changedByResolution ||
        connection.target.changedByResolution) && (
        <div className="connections-resolution-panel">
          <div className="connections-resolution-heading">
            Resolution changed the live edge
          </div>
          <ResolutionRow title="origin" side={connection.origin} />
          <ResolutionRow title="target" side={connection.target} />
        </div>
      )}

      <div className="connections-explanation-panel">
        <div className="connections-meta-label">explanation</div>
        {connection.explanations.length > 0 ? (
          <div className="connections-explanation-list">
            {connection.explanations.map((explanation) => (
              <div className="connections-explanation-item" key={explanation}>
                {explanation}
              </div>
            ))}
          </div>
        ) : connection.explanation ? (
          <div className="connections-explanation-item">
            {connection.explanation}
          </div>
        ) : (
          <div className="connections-empty-inline">
            No explanation was attached to this connection.
          </div>
        )}
      </div>

      {isInteractive && (
        <div className="connections-inline-hint">
          Hover or click to highlight the source range in the active file.
        </div>
      )}
    </div>
  );
};

const ConnectionColumn: React.FC<{
  title: string;
  groups: ConnectionGroup[];
  emptyMessage: string;
  direction: 'incoming' | 'outgoing';
  activeModuleLabel: string;
  onHover?: (connection: SerializedModuleGraphConnection) => void;
  onLeave?: () => void;
  onSelect?: (connection: SerializedModuleGraphConnection) => void;
}> = ({
  title,
  groups,
  emptyMessage,
  direction,
  activeModuleLabel,
  onHover,
  onLeave,
  onSelect,
}) => (
  <Card className="connections-column-card" title={title}>
    {groups.length > 0 ? (
      <div className="connections-group-list">
        {groups.map((group) => (
          <section className="connections-group" key={group.key}>
            <div className={styles.connectionsGroupHeader}>
              <div className={styles.connectionsGroupHeaderTop}>
                <div className="connections-group-title">{group.title}</div>
                <StatusPill
                  label={`${group.connections.length} edge${group.connections.length === 1 ? '' : 's'}`}
                  tone="slate"
                />
              </div>
              <div className="connections-group-description">
                {group.description}
              </div>
            </div>
            <div className="connections-card-list">
              {group.connections.map((connection, index) => (
                <ConnectionCard
                  key={`${group.key}-${direction}-${connection.dependencyType ?? 'no-type'}-${connection.request ?? 'no-request'}-${index}`}
                  connection={connection}
                  direction={direction}
                  activeModuleLabel={activeModuleLabel}
                  onHover={onHover}
                  onLeave={onLeave}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    ) : (
      <div className="connections-empty-hint">{emptyMessage}</div>
    )}
  </Card>
);

const ModuleGraphConnectionView: React.FC<ModuleGraphConnectionViewProps> = ({
  module,
  onHoverOutgoingConnection,
  onLeaveOutgoingConnection,
  onSelectOutgoingConnection,
}) => {
  const moduleGraphConnections = module.moduleGraphConnections;

  if (!moduleGraphConnections) {
    return (
      <Card className="connections-hero-card" title="ModuleGraphConnection">
        <div className="connections-empty-hint">
          This module does not expose serialized ModuleGraphConnection data.
        </div>
      </Card>
    );
  }

  const moduleLabel = getModuleLabel(module.path);
  const outgoingGroups = groupOutgoingConnections(
    moduleGraphConnections.outgoing,
  );
  const incomingGroups = groupIncomingConnections(
    moduleGraphConnections.incoming,
  );
  const allConnections = [
    ...moduleGraphConnections.outgoing,
    ...moduleGraphConnections.incoming,
  ];
  const activeCount = allConnections.filter(
    (connection) => connection.activeState === 'active',
  ).length;
  const conditionalCount = allConnections.filter(
    (connection) => connection.conditional,
  ).length;
  const weakCount = allConnections.filter(
    (connection) => connection.weak,
  ).length;

  return (
    <div className="connections-view">
      <Card className="connections-hero-card">
        <div className="connections-hero-header">
          <div>
            <div className="exports-eyebrow">Following active file:</div>
            <h2 className="exports-hero-title">{moduleLabel}</h2>
            <div className="exports-hero-path">{module.path}</div>
          </div>
          <div className="exports-pill-row">
            <StatusPill
              label={`${moduleGraphConnections.outgoing.length} outgoing`}
              tone="sky"
            />
            <StatusPill
              label={`${moduleGraphConnections.incoming.length} incoming`}
              tone="slate"
            />
          </div>
        </div>

        <div className="connections-summary-grid">
          <SummaryStat
            label="outgoing"
            value={String(moduleGraphConnections.outgoing.length)}
          />
          <SummaryStat
            label="incoming"
            value={String(moduleGraphConnections.incoming.length)}
          />
          <SummaryStat
            label="active"
            value={String(activeCount)}
            tone="emerald"
          />
          <SummaryStat
            label="conditional"
            value={String(conditionalCount)}
            tone="sky"
          />
          <SummaryStat label="weak" value={String(weakCount)} tone="amber" />
        </div>

        <div className="connections-legend">
          <div className="connections-legend-item">
            <StatusPill label="active" tone="emerald" />
            <span>Directly alive for the current runtime snapshot.</span>
          </div>
          <div className="connections-legend-item">
            <StatusPill label="inactive" tone="graphite" />
            <span>
              Webpack kept the edge object, but it is not currently live.
            </span>
          </div>
          <div className="connections-legend-item">
            <StatusPill label="transitive only" tone="amber" />
            <span>
              The direct edge is trimmed, but downstream transitive usage may
              survive.
            </span>
          </div>
          <div className="connections-legend-item">
            <StatusPill label="circular connection" tone="sky" />
            <span>The state was detected while walking a cycle.</span>
          </div>
          <div className="connections-legend-item">
            <StatusPill label="conditional" tone="sky" />
            <span>
              A runtime condition decides whether this edge stays active.
            </span>
          </div>
          <div className="connections-legend-item">
            <StatusPill label="weak" tone="amber" />
            <span>
              The edge does not force the target module to stay included.
            </span>
          </div>
        </div>
      </Card>

      <div className={styles.connections}>
        <ConnectionColumn
          title={
            <Tooltip
              trigger="hover"
              content="Connections from the active module to this target module."
            >
              Outgoing Connections
            </Tooltip>
          }
          groups={outgoingGroups}
          emptyMessage="No outgoing ModuleGraphConnection objects were recorded for this module."
          direction="outgoing"
          activeModuleLabel={moduleLabel}
          onHover={onHoverOutgoingConnection}
          onLeave={onLeaveOutgoingConnection}
          onSelect={onSelectOutgoingConnection}
        />
        <ConnectionColumn
          title={
            <Tooltip
              trigger="hover"
              content="Connections from this origin module into the active module."
            >
              Incoming Connections
            </Tooltip>
          }
          groups={incomingGroups}
          emptyMessage="No incoming ModuleGraphConnection objects were recorded for this module."
          direction="incoming"
          activeModuleLabel={moduleLabel}
        />
      </div>
    </div>
  );
};

export default ModuleGraphConnectionView;
