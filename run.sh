
echo "Starting Antigravity Pipeline..."
echo "--------------------------------"

# 1. To Run the Server (API)
echo "Run this command to start the server:"
echo "bun src/index.ts"
echo ""

# 2. To Run the Verification Script (Headless Test)
echo "Run this command to verify the pipeline logic:"
echo "bun verify_pipeline.ts"
echo ""

# 3. To Run the Full Integration Test (HTTP Calls)
echo "Run this command (in a separate terminal) while server is running:"
echo "bun test_pipeline.ts"
