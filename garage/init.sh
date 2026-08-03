#!/usr/bin/env sh
# Brings a fresh Garage node to the point where the workers can upload:
# a layout, the dev key from .env, and the bucket it may write to.
# Idempotent — re-running it on a configured node changes nothing.
set -eu

garage() {
	docker compose exec -T garage /garage "$@"
}

for var in S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET; do
	eval "value=\${$var:-}"
	if [ -z "$value" ]; then
		echo "$var is not set. Run through 'pnpm garage:init', which loads .env." >&2
		exit 1
	fi
done

# A node with no role serves nothing: every bucket call fails with
# "Layout not ready" until it is given one.
if garage status 2>/dev/null | grep -q "NO ROLE ASSIGNED"; then
	node_id=$(garage status 2>/dev/null | awk '/NO ROLE ASSIGNED/ { print $1 }')
	version=$(garage layout show 2>/dev/null | awk '/layout version:/ { print $NF }')
	echo "Assigning layout to node $node_id"
	garage layout assign -z dc1 -c 1G "$node_id" >/dev/null
	garage layout apply --version "$((version + 1))" >/dev/null
fi

if garage key info "$S3_ACCESS_KEY" >/dev/null 2>&1; then
	echo "Key $S3_ACCESS_KEY already imported"
else
	echo "Importing key $S3_ACCESS_KEY"
	garage key import "$S3_ACCESS_KEY" "$S3_SECRET_KEY" -n brief-dev --yes >/dev/null
fi

if garage bucket info "$S3_BUCKET" >/dev/null 2>&1; then
	echo "Bucket $S3_BUCKET already exists"
else
	echo "Creating bucket $S3_BUCKET"
	garage bucket create "$S3_BUCKET" >/dev/null
fi

garage bucket allow --read --write --owner "$S3_BUCKET" --key "$S3_ACCESS_KEY" >/dev/null

echo "Garage is ready: bucket '$S3_BUCKET' writable by '$S3_ACCESS_KEY'."
