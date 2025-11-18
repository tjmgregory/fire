/**
 * Configuration Manager
 *
 * Handles access to Script Properties for all configuration values.
 * Supports environment-based configuration with type-safe access patterns.
 *
 * @module infrastructure/config/ConfigurationManager
 */

/**
 * OpenAI API configuration
 */
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Exchange Rate API configuration
 */
export interface ExchangeRateConfig {
  provider: string;
  apiKey?: string;
}

/**
 * Bank source configuration
 */
export interface BankSourceConfig {
  sourceId: string;
  sheetName: string;
  enabled: boolean;
}

/**
 * Configuration error thrown when required config is missing or invalid
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Configuration Manager
 *
 * Provides centralized access to Script Properties with type safety
 * and validation for required configuration values.
 */
export class ConfigurationManager {
  /**
   * Get a configuration value from Script Properties
   *
   * @param key - Configuration key
   * @param defaultValue - Default value if key not found
   * @returns Configuration value or default
   */
  static get(key: string, defaultValue: string | null = null): string | null {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(key) || defaultValue;
  }

  /**
   * Get a required configuration value
   *
   * @param key - Configuration key
   * @returns Configuration value
   * @throws ConfigurationError if key is missing
   */
  static getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new ConfigurationError(`Missing required configuration: ${key}`);
    }
    return value;
  }

  /**
   * Set a configuration value in Script Properties
   *
   * @param key - Configuration key
   * @param value - Configuration value
   */
  static set(key: string, value: string): void {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(key, value);
  }

  /**
   * Get OpenAI API configuration
   *
   * @returns OpenAI configuration object
   * @throws ConfigurationError if OPENAI_API_KEY is missing
   */
  static getOpenAIConfig(): OpenAIConfig {
    return {
      apiKey: this.getRequired('OPENAI_API_KEY'),
      model: this.get('OPENAI_MODEL', 'gpt-4') || 'gpt-4',
      temperature: parseFloat(this.get('OPENAI_TEMPERATURE', '0.3') || '0.3'),
      maxTokens: parseInt(this.get('OPENAI_MAX_TOKENS', '500') || '500', 10)
    };
  }

  /**
   * Get Exchange Rate API configuration
   *
   * @returns Exchange Rate configuration object
   */
  static getExchangeRateConfig(): ExchangeRateConfig {
    return {
      provider: this.get('EXCHANGE_RATE_PROVIDER', 'https://api.exchangerate-api.com/v4/latest/') || 'https://api.exchangerate-api.com/v4/latest/',
      apiKey: this.get('EXCHANGE_RATE_API_KEY') || undefined
    };
  }

  /**
   * Get bank source configurations
   *
   * Returns configurations for all supported bank sources (Monzo, Revolut, Yonder).
   * Sources can be individually enabled/disabled via Script Properties.
   *
   * @returns Array of bank source configurations
   */
  static getBankSourceConfigs(): BankSourceConfig[] {
    const sources: BankSourceConfig[] = [
      {
        sourceId: 'MONZO',
        sheetName: this.get('MONZO_SHEET_NAME', 'Monzo') || 'Monzo',
        enabled: this.get('MONZO_ENABLED', 'true') === 'true'
      },
      {
        sourceId: 'REVOLUT',
        sheetName: this.get('REVOLUT_SHEET_NAME', 'Revolut') || 'Revolut',
        enabled: this.get('REVOLUT_ENABLED', 'true') === 'true'
      },
      {
        sourceId: 'YONDER',
        sheetName: this.get('YONDER_SHEET_NAME', 'Yonder') || 'Yonder',
        enabled: this.get('YONDER_ENABLED', 'true') === 'true'
      }
    ];

    return sources.filter(source => source.enabled);
  }

  /**
   * Validate required configuration at startup
   *
   * @throws ConfigurationError if any required configuration is missing
   */
  static validateConfiguration(): void {
    const requiredKeys = [
      'OPENAI_API_KEY',
      'RESULT_SHEET_NAME',
      'CATEGORIES_SHEET_NAME'
    ];

    const missing = requiredKeys.filter(key => !this.get(key));

    if (missing.length > 0) {
      throw new ConfigurationError(`Missing required configuration: ${missing.join(', ')}`);
    }
  }
}
