import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {ItemProps} from '../types';

type Draft = {source: unknown; value: unknown};
type Drafts = Record<string, Draft>;
type DraftContext = {
  drafts: Drafts;
  update(id: string, source: unknown, value: unknown): void;
};
const Context = createContext<DraftContext | null>(null);

/** In-memory edits survive tool stack pops; source updates still replace drafts. */
export function PropertyDraftProvider({
  properties,
  children,
}: {
  properties: ItemProps[];
  children: React.ReactNode;
}) {
  const [drafts, setDrafts] = useState<Drafts>({});
  useEffect(() => {
    setDrafts(current => {
      const kept = Object.entries(current).filter(([id, draft]) =>
        properties.some(
          property =>
            property.id === id &&
            property.editable &&
            Object.is(property.value, draft.source),
        ),
      );
      return kept.length === Object.keys(current).length
        ? current
        : Object.fromEntries(kept);
    });
  }, [properties]);
  const update = useCallback((id: string, source: unknown, value: unknown) => {
    setDrafts(current => ({...current, [id]: {source, value}}));
  }, []);
  const context = useMemo(() => ({drafts, update}), [drafts, update]);
  return <Context.Provider value={context}>{children}</Context.Provider>;
}

export function usePropertyDraft(id: string | undefined, source: unknown) {
  const context = useContext(Context);
  const [local, setLocal] = useState<unknown>(() => source);
  useEffect(() => setLocal(() => source), [source]);
  const draft = id ? context?.drafts[id] : undefined;
  const value =
    context && id
      ? draft && Object.is(draft.source, source)
        ? draft.value
        : source
      : local;
  const update = (next: unknown) => {
    if (context && id) context.update(id, source, next);
    else setLocal(() => next);
  };
  return [value, update] as const;
}
