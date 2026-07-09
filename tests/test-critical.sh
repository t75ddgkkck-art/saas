#!/bin/bash

# Tests critiques pour Vitrix
# Exécuter après avoir démarré le serveur

BASE_URL="http://localhost:3000"
PASS=0
FAIL=0

echo "═══════ TESTS CRITIQUES VITRIX ═════"
echo ""

# Test 1 : Page d'accueil
echo "Test 1: Page d'accueil"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/)
if [ "$STATUS" = "200" ]; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL (HTTP $STATUS)"
  ((FAIL++))
fi

# Test 2 : Page À propos
echo "Test 2: Page À propos"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/a-propos)
if [ "$STATUS" = "200" ]; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL (HTTP $STATUS)"
  ((FAIL++))
fi

# Test 3 : API inscription - email invalide
echo "Test 3: API inscription - email invalide"
RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"invalid","password":"test123","businessName":"Test","siret":"35600000000048","category":"plombier","city":"Paris"}')
if echo "$RESPONSE" | grep -q "error"; then
  echo "✅ PASS (rejeté)"
  ((PASS++))
else
  echo "❌ FAIL (accepté)"
  ((FAIL++))
fi

# Test 4 : API inscription - SIRET invalide
echo "Test 4: API inscription - SIRET invalide"
RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@test.com","password":"test123","businessName":"Test","siret":"12345","category":"plombier","city":"Paris"}')
if echo "$RESPONSE" | grep -q "error"; then
  echo "✅ PASS (rejeté)"
  ((PASS++))
else
  echo "❌ FAIL (accepté)"
  ((FAIL++))
fi

# Test 5 : API avis public - données manquantes
echo "Test 5: API avis public - données manquantes"
RESPONSE=$(curl -s -X POST $BASE_URL/api/reviews/public \
  -H "Content-Type: application/json" \
  -d '{}')
if echo "$RESPONSE" | grep -q "error"; then
  echo "✅ PASS (rejeté)"
  ((PASS++))
else
  echo "❌ FAIL (accepté)"
  ((FAIL++))
fi

# Test 6 : API équipe sans auth (doit être 401)
echo "Test 6: API équipe sans authentification"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/api/team)
if [ "$STATUS" = "401" ]; then
  echo "✅ PASS (401)"
  ((PASS++))
else
  echo "❌ FAIL (HTTP $STATUS)"
  ((FAIL++))
fi

# Test 7 : Page demo n'existe plus
echo "Test 7: Page /demo supprimée"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/demo)
if [ "$STATUS" = "404" ]; then
  echo "✅ PASS (404)"
  ((PASS++))
else
  echo "❌ FAIL (HTTP $STATUS)"
  ((FAIL++))
fi

# Test 8 : Annuaire public
echo "Test 8: Annuaire public"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/annuaire)
if [ "$STATUS" = "200" ]; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL (HTTP $STATUS)"
  ((FAIL++))
fi

# Test 9 : Blog public
echo "Test 9: Blog public"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/blog)
if [ "$STATUS" = "200" ]; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL (HTTP $STATUS)"
  ((FAIL++))
fi

# Test 10 : Sitemap
echo "Test 10: Sitemap"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/sitemap.xml)
if [ "$STATUS" = "200" ]; then
  echo "✅ PASS"
  ((PASS++))
else
  echo "❌ FAIL (HTTP $STATUS)"
  ((FAIL++))
fi

echo ""
echo "═══════ RÉSULTATS ═════"
echo "✅ PASS: $PASS"
echo "❌ FAIL: $FAIL"
echo "Total: $((PASS + FAIL))"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 Tous les tests passent !"
else
  echo "⚠️  Certains tests échouent"
fi
