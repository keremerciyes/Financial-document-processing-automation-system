// src/services/fuzzyMatch.ts
import { qbo } from './qbo';
import type { Compartment } from './qbo';

// Levenshtein Distance Implementation
function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));

    for (let i = 0; i <= b.length; i++) {
        matrix[i]![0] = i;
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0]![j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i]![j] = matrix[i - 1]![j - 1] as number;
            } else {
                matrix[i]![j] = Math.min(
                    (matrix[i - 1]![j - 1] as number) + 1, // substitution
                    Math.min(
                        (matrix[i]![j - 1] as number) + 1, // insertion
                        (matrix[i - 1]![j] as number) + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length]![a.length] as number;
}

export function similarityScore(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Boost for inclusion
    if (s1.includes(s2) || s2.includes(s1)) {
        return 0.85;
    }

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    const distance = levenshteinDistance(s1, s2);
    return 1 - (distance / maxLen);
}

export interface MatchResult {
    compartment: Compartment;
    score: number;
    strategy: string;
}

export function assignCompartment(
    compartmentHint: string | undefined,
    vendorName: string,
    serviceType: string | undefined
): MatchResult {
    const compartments = qbo.getCompartments();
    let bestMatch: MatchResult | null = null;

    // Strategy 1: LLM Hint Match (Threshold 0.6)
    if (compartmentHint) {
        for (const comp of compartments) {
            const score = similarityScore(compartmentHint, comp.name);
            // Also check code
            const codeScore = similarityScore(compartmentHint, comp.code);
            const maxScore = Math.max(score, codeScore);

            if (maxScore > 0.6) {
                if (!bestMatch || maxScore > bestMatch.score) {
                    bestMatch = { compartment: comp, score: maxScore, strategy: 'LLM Hint Match' };
                }
            }
        }
    }
    if (bestMatch) return bestMatch;

    // Strategy 2: Vendor Name Match (Threshold 0.5)
    for (const comp of compartments) {
        const score = similarityScore(vendorName, comp.name);
        if (score > 0.5) {
            if (!bestMatch || score > bestMatch.score) {
                bestMatch = { compartment: comp, score: score, strategy: 'Vendor Name Match' };
            }
        }
    }
    if (bestMatch) return bestMatch;

    // Strategy 3: Service Type Match (Threshold 0.6)
    if (serviceType) {
        for (const comp of compartments) {
            const score = similarityScore(serviceType, comp.name);
            if (score > 0.6) {
                if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { compartment: comp, score: score, strategy: 'Service Type Match' };
                }
            }
        }
    }
    if (bestMatch) return bestMatch;

    // Strategy 4: Default Fallback
    return { compartment: compartments[0]!, score: 0, strategy: 'Default Fallback' };
}
