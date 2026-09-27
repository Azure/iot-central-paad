import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {
  PropertyDraftProvider,
  usePropertyDraft,
} from '../src/runtime/propertyDrafts';

it('retains edits across tool unmounts but replaces drafts when the source changes', () => {
  let draft;
  function Tool({value}) {
    draft = usePropertyDraft('readOnlyProp', value);
    return null;
  }
  const render = (visible, value) => (
    <PropertyDraftProvider
      properties={[{id: 'readOnlyProp', editable: true, value}]}>
      {visible && <Tool value={value} />}
    </PropertyDraftProvider>
  );
  let view;
  act(() => {
    view = renderer.create(render(true, undefined));
  });
  act(() => draft[1]('unsent'));
  expect(draft[0]).toBe('unsent');
  act(() => view.update(render(false, undefined)));
  act(() => view.update(render(true, undefined)));
  expect(draft[0]).toBe('unsent');
  act(() => view.update(render(false, 'cloud-source')));
  act(() => view.update(render(true, 'cloud-source')));
  expect(draft[0]).toBe('cloud-source');
  act(() => view.update(render(true, undefined)));
  expect(draft[0]).toBeUndefined();
  act(() => view.unmount());
});
