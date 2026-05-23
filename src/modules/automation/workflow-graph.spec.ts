import { resolveGraphV2, resolveWorkflowGraphEdges } from './workflow-graph';
import type { WorkflowGraphV2 } from './workflow-graph.types';

describe('resolveGraphV2', () => {
  const steps = [
    { id: 'db-s1', order: 1, config: { stepKey: 'k1' } },
    { id: 'db-s2', order: 2, config: { stepKey: 'k2' } },
    { id: 'db-s3', order: 3, config: { stepKey: 'k3' } },
    { id: 'db-s4', order: 4, config: { stepKey: 'k4' } },
  ];

  it('3 fork + 1 chain từ k1', () => {
    const graph: WorkflowGraphV2 = {
      version: 2,
      edges: [
        { from: '__trigger__', to: 'k1' },
        { from: '__trigger__', to: 'k2' },
        { from: '__trigger__', to: 'k3' },
        { from: 'k1', to: 'k4' },
      ],
    };

    const resolved = resolveGraphV2(steps, graph);
    expect(resolved.filter((e) => e.source === '__trigger__')).toHaveLength(3);
    expect(resolved.some((e) => e.source === 'db-s1' && e.target === 'db-s4')).toBe(true);
    expect(resolved.some((e) => e.source === '__trigger__' && e.target === 'db-s4')).toBe(
      false,
    );
  });

  it('resolveWorkflowGraphEdges từ workflow.graph', () => {
    const graph: WorkflowGraphV2 = {
      version: 2,
      edges: [{ from: '__trigger__', to: 'k1' }, { from: 'k1', to: 'k4' }],
    };
    const edges = resolveWorkflowGraphEdges(steps, graph);
    expect(edges.length).toBe(2);
  });
});
