export interface SearchResult<T = any> {
  item: T;
  score: number;
  highlighted?: string;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  fuzzy?: boolean;
  highlightMatches?: boolean;
}

export class SearchOptimizer {
  static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .trim();
  }

  static calculateLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  static fuzzySearch(query: string, text: string): number {
    const normalizedQuery = this.normalizeText(query);
    const normalizedText = this.normalizeText(text);

    let score = 0;
    let queryIndex = 0;

    for (let i = 0; i < normalizedText.length && queryIndex < normalizedQuery.length; i++) {
      if (normalizedText[i] === normalizedQuery[queryIndex]) {
        score++;
        queryIndex++;
      }
    }

    // Check if all characters matched
    if (queryIndex !== normalizedQuery.length) {
      return 0;
    }

    // Bonus for exact match
    if (normalizedText === normalizedQuery) {
      return 100;
    }

    // Bonus for prefix match
    if (normalizedText.startsWith(normalizedQuery)) {
      score += 50;
    }

    return score;
  }

  static search<T>(
    items: T[],
    query: string,
    searchFields: (keyof T)[],
    options: SearchOptions = {},
  ): SearchResult<T>[] {
    if (!query) return [];

    const { caseSensitive = false, fuzzy = true } = options;
    const normalizedQuery = caseSensitive ? query : this.normalizeText(query);

    const results: SearchResult<T>[] = [];

    items.forEach((item) => {
      let maxScore = 0;

      searchFields.forEach((field) => {
        const value = String(item[field] || '');
        const normalizedValue = caseSensitive ? value : this.normalizeText(value);

        let score = 0;

        if (fuzzy) {
          score = this.fuzzySearch(normalizedQuery, normalizedValue);
        } else {
          if (normalizedValue.includes(normalizedQuery)) {
            score = 100 - (normalizedValue.length - normalizedQuery.length);
          }
        }

        maxScore = Math.max(maxScore, score);
      });

      if (maxScore > 0) {
        results.push({ item, score: maxScore });
      }
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  static highlightMatches(text: string, query: string, tag: string = '***'): string {
    const normalizedText = this.normalizeText(text);
    const normalizedQuery = this.normalizeText(query);

    if (!normalizedText.includes(normalizedQuery)) {
      return text;
    }

    const index = normalizedText.indexOf(normalizedQuery);
    const before = text.substring(0, index);
    const match = text.substring(index, index + normalizedQuery.length);
    const after = text.substring(index + normalizedQuery.length);

    return `${before}${tag}${match}${tag}${after}`;
  }

  static debounceSearch<T>(
    fn: (query: string, items: T[]) => SearchResult<T>[],
    delay: number = 300,
  ): (query: string, items: T[]) => Promise<SearchResult<T>[]> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return (query: string, items: T[]) => {
      return new Promise((resolve) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          resolve(fn(query, items));
        }, delay);
      });
    };
  }

  static getSearchSuggestions(
    items: string[],
    query: string,
    maxSuggestions: number = 5,
  ): string[] {
    const results = this.search(
      items,
      query,
      ['0'] as any, // String array hack
      { fuzzy: true },
    );

    return results
      .slice(0, maxSuggestions)
      .map((r) => r.item)
      .filter((item) => item !== query); // Filter out exact match
  }
}
