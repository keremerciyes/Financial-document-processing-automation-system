from .qbo import qbo, Compartment
from typing import Optional

def levenshtein_distance(a: str, b: str) -> int:
    matrix = [[0] * (len(a) + 1) for _ in range(len(b) + 1)]

    for i in range(len(b) + 1):
        matrix[i][0] = i

    for j in range(len(a) + 1):
        matrix[0][j] = j

    for i in range(1, len(b) + 1):
        for j in range(1, len(a) + 1):
            if b[i - 1] == a[j - 1]:
                matrix[i][j] = matrix[i - 1][j - 1]
            else:
                matrix[i][j] = min(
                    matrix[i - 1][j - 1] + 1,  # substitution
                    matrix[i][j - 1] + 1,      # insertion
                    matrix[i - 1][j] + 1       # deletion
                )

    return matrix[len(b)][len(a)]

def similarity_score(str1: str, str2: str) -> float:
    s1 = str1.lower()
    s2 = str2.lower()

    # Boost for inclusion
    if s1 in s2 or s2 in s1:
        return 0.85

    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 1.0

    distance = levenshtein_distance(s1, s2)
    return 1 - (distance / max_len)

class MatchResult:
    def __init__(self, compartment: Compartment, score: float, strategy: str):
        self.compartment = compartment
        self.score = score
        self.strategy = strategy

def assign_compartment(
    compartment_hint: Optional[str],
    vendor_name: str,
    service_type: Optional[str]
) -> MatchResult:
    compartments = qbo.get_compartments()
    best_match = None

    # Strategy 1: LLM Hint Match (Threshold 0.6)
    if compartment_hint:
        for comp in compartments:
            score = similarity_score(compartment_hint, comp.name)
            # Also check code
            code_score = similarity_score(compartment_hint, comp.code)
            max_score = max(score, code_score)

            if max_score > 0.6:
                if not best_match or max_score > best_match.score:
                    best_match = MatchResult(comp, max_score, 'LLM Hint Match')
    
    if best_match:
        return best_match

    # Strategy 2: Vendor Name Match (Threshold 0.5)
    for comp in compartments:
        score = similarity_score(vendor_name, comp.name)
        if score > 0.5:
            if not best_match or score > best_match.score:
                best_match = MatchResult(comp, score, 'Vendor Name Match')
                
    if best_match:
        return best_match

    # Strategy 3: Service Type Match (Threshold 0.6)
    if service_type:
        for comp in compartments:
            score = similarity_score(service_type, comp.name)
            if score > 0.6:
                if not best_match or score > best_match.score:
                    best_match = MatchResult(comp, score, 'Service Type Match')
                    
    if best_match:
        return best_match

    # Strategy 4: Default Fallback
    return MatchResult(compartments[0], 0, 'Default Fallback')
