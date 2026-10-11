"""Independent parameterized cookie-domain selection; no credential access."""
import re

class CookieDomainError(ValueError):
    pass

def normalize_cookie_domain(domain: str):
    if not isinstance(domain, str):
        raise CookieDomainError('A domain string is required')
    value = domain.strip().lstrip('.').lower()
    if not value or '\x00' in value:
        raise CookieDomainError('An empty or NUL-containing domain is invalid')
    return value

def escape_sql_like(value: str):
    return value.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')

def domain_where_clause(column: str, domains: list[str]):
    if not isinstance(column, str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', column):
        raise CookieDomainError('A simple SQL column identifier is required')
    if not domains:
        raise CookieDomainError('At least one explicit cookie domain is required')
    clauses, parameters = [], []
    for domain in domains:
        value = normalize_cookie_domain(domain)
        clauses.append(f"({column} = ? OR {column} = ? OR {column} LIKE ? ESCAPE '\\')")
        parameters.extend([value, '.' + value, '%.' + escape_sql_like(value)])
    return ' OR '.join(clauses), parameters
