import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigManager } from '../../../core/ConfigManager';

describe('ConfigManager', () => {
  let defaultConfig;
  let userConfig;

  beforeEach(() => {
    defaultConfig = {
      optionA: 'defaultA',
      optionB: 123,
      optionC: true,
      nested: {
        deepA: 'defaultDeepA'
      }
    };
    userConfig = {
      optionB: 456, // Override
      optionD: 'userD', // New
      nested: {
        deepB: 'userDeepB' // New nested, should merge shallowly by default
      }
    };
  });

  it('should initialize with default options if no user options provided', () => {
    const cm = new ConfigManager({}, defaultConfig);
    expect(cm.getAll()).toEqual(defaultConfig);
  });

  it('should initialize with user options overriding defaults', () => {
    const cm = new ConfigManager(userConfig, defaultConfig);
    const expectedConfig = {
      optionA: 'defaultA',
      optionB: 456, // Overridden by user
      optionC: true,
      optionD: 'userD', // Added by user
      nested: { // User's nested object replaces default's nested object (shallow merge)
        deepB: 'userDeepB'
      }
    };
    expect(cm.getAll()).toEqual(expectedConfig);
  });

  it('should initialize with only user options if no defaults provided', () => {
    const cm = new ConfigManager(userConfig, {});
    expect(cm.getAll()).toEqual(userConfig);
  });

  it('should correctly get a value that exists', () => {
    const cm = new ConfigManager(userConfig, defaultConfig);
    expect(cm.get('optionA')).toBe('defaultA');
    expect(cm.get('optionB')).toBe(456);
    expect(cm.get('optionD')).toBe('userD');
  });

  it('should return undefined for a key that does not exist and no default is provided to get', () => {
    const cm = new ConfigManager(userConfig, defaultConfig);
    expect(cm.get('nonExistentKey')).toBeUndefined();
  });

  it('should return the provided default value from get() if key does not exist', () => {
    const cm = new ConfigManager(userConfig, defaultConfig);
    expect(cm.get('nonExistentKey', 'fallback')).toBe('fallback');
    expect(cm.get('nonExistentKey', null)).toBeNull();
  });

  it('should correctly get a nested value (shallow merge behavior)', () => {
    const cm = new ConfigManager(userConfig, defaultConfig);
    // After shallow merge, defaultConfig.nested is replaced by userConfig.nested
    expect(cm.get('nested').deepA).toBeUndefined(); 
    expect(cm.get('nested').deepB).toBe('userDeepB');
  });

  it('should set a new value or update an existing one', () => {
    const cm = new ConfigManager({}, defaultConfig);
    cm.set('optionA', 'newA');
    expect(cm.get('optionA')).toBe('newA');
    cm.set('newOption', 'added');
    expect(cm.get('newOption')).toBe('added');
  });

  it('set should update a nested object entirely', () => {
    const cm = new ConfigManager(userConfig, defaultConfig);
    cm.set('nested', { newDeep: 'completelyNew' });
    expect(cm.get('nested')).toEqual({ newDeep: 'completelyNew' });
    expect(cm.get('nested').deepB).toBeUndefined(); // Old nested property gone
  });

  it('getAll should return a copy, not a reference', () => {
    const cm = new ConfigManager(userConfig, defaultConfig);
    const allOpts = cm.getAll();
    allOpts.optionA = 'mutated';
    expect(cm.get('optionA')).toBe('defaultA'); // Original should be unchanged
  });
}); 