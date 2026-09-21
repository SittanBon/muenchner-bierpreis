import { describe, it, expect } from 'vitest';
import { stopOffsets, resolveDrop, nextLevelOnTap, PEEK_PX } from './sheetGesture';

const H = 700;

describe('stopOffsets', () => {
  it('full is 0, half is 46% down, collapsed leaves a 120 px peek', () => {
    expect(stopOffsets(H)).toEqual({ full: 0, half: 322, collapsed: H - PEEK_PX });
    expect(PEEK_PX).toBe(120);
  });
  it('stays ordered even on a very short sheet', () => {
    const s = stopOffsets(150);
    expect(s.full).toBeLessThan(s.half); expect(s.half).toBeLessThan(s.collapsed);
  });
});

describe('resolveDrop', () => {
  it('a small drag snaps back to where it started', () => {
    for (const level of ['full', 'half', 'collapsed']) expect(resolveDrop({ level, dy: 12, height: H })).toBe(level);
  });
  it('dragging up from half far enough reaches full; down reaches collapsed', () => {
    expect(resolveDrop({ level: 'half', dy: -300, height: H })).toBe('full');
    expect(resolveDrop({ level: 'half', dy: 250, height: H })).toBe('collapsed');
  });
  it('dragging up from the peek stops at the nearest stop', () => {
    expect(resolveDrop({ level: 'collapsed', dy: -200, height: H })).toBe('half');
    expect(resolveDrop({ level: 'collapsed', dy: -560, height: H })).toBe('full');
  });
  it('a flick moves exactly one stop in its direction, whatever the distance', () => {
    expect(resolveDrop({ level: 'full', dy: 40, height: H, velocity: 1.2 })).toBe('half');
    expect(resolveDrop({ level: 'half', dy: 40, height: H, velocity: 1.2 })).toBe('collapsed');
    expect(resolveDrop({ level: 'half', dy: -40, height: H, velocity: -1.2 })).toBe('full');
    expect(resolveDrop({ level: 'collapsed', dy: -30, height: H, velocity: -1.2 })).toBe('half');
  });
  it('SWIPE DOWN dismisses: dragged past the peek, or flicked down at the peek', () => {
    expect(resolveDrop({ level: 'collapsed', dy: 90, height: H })).toBe('dismiss');
    expect(resolveDrop({ level: 'half', dy: 700, height: H })).toBe('dismiss');
    expect(resolveDrop({ level: 'collapsed', dy: 40, height: H, velocity: 1.0 })).toBe('dismiss');
  });
  it('a flick down from half or full does NOT dismiss — it steps down one stop', () => {
    expect(resolveDrop({ level: 'half', dy: 50, height: H, velocity: 2 })).toBe('collapsed');
    expect(resolveDrop({ level: 'full', dy: 50, height: H, velocity: 2 })).toBe('half');
  });
  it('a slow, small pull down from the peek does not dismiss', () => {
    expect(resolveDrop({ level: 'collapsed', dy: 30, height: H, velocity: 0.1 })).toBe('collapsed');
  });
  it('never returns an offset above fully open', () => {
    expect(resolveDrop({ level: 'full', dy: -500, height: H })).toBe('full');
  });
});

describe('nextLevelOnTap', () => {
  it('collapsed -> half -> full -> half', () => {
    expect(nextLevelOnTap('collapsed')).toBe('half');
    expect(nextLevelOnTap('half')).toBe('full');
    expect(nextLevelOnTap('full')).toBe('half');
  });
});
