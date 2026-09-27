import {Platform, StyleSheet} from 'react-native';
import {DISPLAY_FONT_FAMILY} from './fonts';

export const detailStyles = StyleSheet.create({
  displayTitle: {
    fontFamily: DISPLAY_FONT_FAMILY,
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.2,
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  /** A feed or list entry heading: one quiet step below a section heading. */
  entryTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  value: {fontSize: 15, lineHeight: 22, fontWeight: '400'},
  supporting: {fontSize: 13, lineHeight: 19, fontWeight: '400'},
  actionLabel: {fontSize: 15, lineHeight: 20, fontWeight: '600'},
  status: {fontSize: 13, lineHeight: 18, fontWeight: '600'},
  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  bordered: {borderWidth: StyleSheet.hairlineWidth},
  row: {paddingVertical: 14, gap: 4},
  divided: {borderTopWidth: StyleSheet.hairlineWidth},
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  action: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryAction: {minHeight: 52},
  centered: {alignItems: 'center'},
  centeredLabel: {textAlign: 'center'},
  disabled: {opacity: 0.5},
});
