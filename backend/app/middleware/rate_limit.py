from slowapi import Limiter
from slowapi.util import get_remote_address

# All rate limits are keyed by client IP.
# In production, put Nginx / Cloudflare in front so X-Forwarded-For is set.
limiter = Limiter(key_func=get_remote_address)
