import { describe, expect, it } from 'vitest';
import { docActions } from './docSlice';
import { makeStore } from './store';

describe('document history', () => {
  it('undoes and redoes edits, and a drag gesture is one undo step', () => {
    const store = makeStore();
    const d = store.dispatch;
    d(docActions.addNode({ id: 'a', type: 'value', parent: null, pos: [0, 0] }));
    d(docActions.addNode({ id: 'b', type: 'square', parent: null, pos: [0, -1000] }));
    d(docActions.connect({ id: 'e', from: { node: 'a', port: 'out' }, to: { node: 'b', port: 'x' } }));
    expect(Object.keys(store.getState().doc.present.edges)).toEqual(['e']);

    d(docActions.beginGesture());
    for (let i = 1; i <= 10; i++) d(docActions.moveNodes([{ id: 'a', pos: [i * 10, 0] }]));
    d(docActions.endGesture());
    expect(store.getState().doc.present.nodes.a.pos).toEqual([100, 0]);

    d(docActions.undo());
    expect(store.getState().doc.present.nodes.a.pos).toEqual([0, 0]);
    d(docActions.undo());
    expect(store.getState().doc.present.edges).toEqual({});
    d(docActions.redo());
    d(docActions.redo());
    expect(store.getState().doc.present.nodes.a.pos).toEqual([100, 0]);
  });

  it('keeps untouched nodes identical (structural sharing) and rejects invalid edits without history', () => {
    const store = makeStore();
    const d = store.dispatch;
    d(docActions.addNode({ id: 'a', type: 'value', parent: null, pos: [0, 0] }));
    d(docActions.addNode({ id: 'b', type: 'value', parent: null, pos: [0, 0] }));
    const before = store.getState().doc.present;
    d(docActions.moveNodes([{ id: 'a', pos: [5, 5] }]));
    const after = store.getState().doc.present;
    expect(after.nodes.b).toBe(before.nodes.b);
    expect(after.nodes.a).not.toBe(before.nodes.a);

    const pastLength = store.getState().doc.past.length;
    d(docActions.connect({ id: 'x', from: { node: 'a', port: 'out' }, to: { node: 'b', port: 'nope' } }));
    expect(store.getState().doc.rejected).toMatch(/No input/);
    expect(store.getState().doc.past.length).toBe(pastLength);
  });
});
