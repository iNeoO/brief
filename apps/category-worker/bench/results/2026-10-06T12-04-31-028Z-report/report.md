# Banc LLM Brief

## tools

| modèle | mode | runs | réussite | JSON | appels | latence méd. | tokens in/out | routé via | verdict |
|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-120b | two-phase | 1/1 | 100 % | 100 % | parallèle ×1 | 2.0 s | 1108 / 452 | groq/openai/gpt-oss-120b | ✅ |
| qwen3.8-27b | two-phase | 1/1 | 100 % | 100 % | parallèle ×2 | 3.0 s | 1089 / 200 | groq/qwen/qwen3.8-27b | ✅ |
| command-a-2 | two-phase | 1/1 | 100 % | 100 % | parallèle ×2 | 3.1 s | 422 / 687 | cohere/command-a-plus-05-2026 | ✅ |
| ministral-14b | two-phase | 1/1 | 100 % | 100 % | parallèle ×2 | 3.6 s | 569 / 202 | mistral/ministral-14b-2512, mistral/ministral-14b-latest | ✅ |
| gemini-3.5-flash | two-phase | 1/1 | 100 % | 100 % | parallèle ×1 | 5.0 s | 578 / 56 | google/gemini-3.5-flash | ✅ |
| nemotron-3-super-120b | two-phase | 1/1 | 100 % | 100 % | parallèle ×1 | 5.9 s | 1771 / 491 | openrouter/nvidia/nemotron-3-super-120b-a12b:free | ✅ |
| command-a | two-phase | 1/1 | 100 % | 100 % | parallèle ×2 | 6.0 s | 422 / 159 | cohere/command-a-03-2025 | ✅ |
| command-a-reasoning | two-phase | 1/1 | 100 % | 100 % | parallèle ×2 | 7.1 s | 422 / 909 | cohere/command-a-reasoning-08-2025 | ✅ |
| gpt-oss-20b | two-phase | 1/1 | 100 % | 100 % | parallèle ×1 | 17.3 s | 1093 / 565 | ollama/gpt-oss:20b, groq/openai/gpt-oss-20b | ✅ |
| nemotron-3.5-lightning | two-phase | 1/1 | 100 % | 100 % | parallèle ×1 | 32.9 s | 1830 / 466 | openrouter/nvidia/nemotron-3.5-lightning:free | ✅ |
| nemotron-3-ultra | two-phase | 1/1 | 100 % | 100 % | parallèle ×2 | 66.9 s | 1066 / 753 | ollama/nemotron-3-ultra | ✅ |
| claude-opus-4-5 | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 0.1 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| claude-sonnet-4-5 | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 0.1 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| claude-haiku-4-5 | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 0.1 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| gemini-2.5-flash | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 0.2 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| gemini-2.5-flash-lite | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 0.2 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| gemma-4-31b-it | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 1.2 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| aya-expanse-32b | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 1.3 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| gemma-4-26b-a4b | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 1.4 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| gemma-4-31b | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 1.4 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| poolside-laguna-xs-2.1 | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 1.5 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| gemini-3.1-flash-lite | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 11.1 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| gemini-3-flash-preview | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 12.3 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| north-mini-code | two-phase | 1/1 | 0 % | 0 % | parallèle ×2 | 18.7 s | 312 / 502 | cohere/north-mini-code-1-0 | JSON non conforme, copie inexacte, réussite < 95 % |
| gemini-3.5-flash-lite | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 20.4 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| command-r | two-phase | 1/1 | 0 % | 0 % | parallèle ×2 | 21.7 s | 312 / 79 | cohere/command-r-08-2024 | JSON non conforme, copie inexacte, réussite < 95 % |
| ministral-8b | two-phase | 1/1 | 0 % | 0 % | parallèle ×2 | 22.6 s | 392 / 104 | mistral/ministral-8b-2512 | JSON non conforme, copie inexacte, réussite < 95 % |
| command-r-2 | two-phase | 1/1 | 0 % | 0 % | parallèle ×2 | 25.5 s | 312 / 97 | cohere/command-r-plus-08-2024 | JSON non conforme, copie inexacte, réussite < 95 % |
| nemotron-3-super | two-phase | 1/1 | 0 % | 0 % | parallèle ×1 | 27.4 s | 1268 / 501 | ollama/nemotron-3-super | JSON non conforme, copie inexacte, réussite < 95 % |
| glm-4.5-flash | two-phase | 1/1 | 0 % | 0 % | parallèle ×2 | 28.1 s | 706 / 367 | zhipu/glm-4.5-flash | JSON non conforme, copie inexacte, réussite < 95 % |
| ministral-3-8b | two-phase | 1/1 | 0 % | 0 % | parallèle ×2 | 33.2 s | 394 / 106 | mistral/ministral-8b-latest | JSON non conforme, copie inexacte, réussite < 95 % |
| mistral-code | two-phase | 1/1 | 0 % | 0 % | parallèle ×2 | 39.6 s | 395 / 92 | mistral/mistral-code-latest | JSON non conforme, copie inexacte, réussite < 95 % |
| glm-4.7-flash | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 56.3 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| gemini-3.7-flash | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 92.3 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| poolside-laguna-s-2.1 | two-phase | 1/1 | 0 % | 0 % | parallèle ×1 | 92.4 s | 206 / 44 | openrouter/poolside/laguna-s-2.1:free | JSON non conforme, copie inexacte, réussite < 95 % |
| gemini-3.8-flash | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 92.7 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| gemini-3.6-flash | two-phase | 1/1 | 0 % | 0 % | parallèle ×0 | 94.6 s | 0 / 0 | – | JSON non conforme, copie inexacte, réussite < 95 % |
| nemotron-3-nano-30b | two-phase | 1/1 | 0 % | 0 % | parallèle ×1 | 655.7 s | 1275 / 1536 | ollama/nemotron-3-nano:30b | JSON non conforme, copie inexacte, réussite < 95 % |

## selection

| modèle | mode | runs | réussite | JSON | UUID inventés / vides / pièges / paires doublons / recouvrement réf. | latence méd. | tokens in/out | routé via | verdict |
|---|---|---|---|---|---|---|---|---|---|
| gemini-3.5-flash | combined | 1/1 | 100 % | 100 % | 0 / 0 / 0 / 0 / 100 % | 28.4 s | 7660 / 296 | google/gemini-3.5-flash | ✅ |
| command-a-reasoning | combined | 1/1 | 100 % | 100 % | 0 / 0 / 0 / 0 / 88 % | 30.7 s | 7660 / 3388 | cohere/command-a-reasoning-08-2025 | ✅ |
| gemini-3.5-flash | two-phase | 3/3 | 100 % | 100 % | 0 / 0 / 0 / 0 / 93 % | 46.8 s | 15511 / 478 | google/gemini-3.5-flash | ✅ |
| command-a-2 | combined | 1/1 | 100 % | 100 % | 0 / 0 / 0 / 0 / 75 % | 11.9 s | 7660 / 2735 | cohere/command-a-plus-05-2026 | ✅ |
| command-a | two-phase | 1/1 | 100 % | 100 % | 0 / 0 / 0 / 0 / 75 % | 29.2 s | 13908 / 1056 | cohere/command-a-03-2025 | ✅ |
| command-a-reasoning | two-phase | 7/9 | 100 % | 100 % | 0 / 0 / 0 / 0 / 75 % | 59.4 s | 15282 / 6217 | cohere/command-a-reasoning-08-2025 | ✅ |
| gpt-oss-20b | combined | 1/1 | 100 % | 100 % | 0 / 0 / 0 / 0 / 50 % | 22.6 s | 9125 / 2130 | ollama/gpt-oss:20b | ✅ |
| nemotron-3-super-120b | two-phase | 7/7 | 100 % | 100 % | 0 / 0 / 0 / 0 / 66 % | 139.0 s | 32927 / 14461 | openrouter/nvidia/nemotron-3-super-120b-a12b:free | ✅ |
| gpt-oss-20b | two-phase | 1/1 | 100 % | 100 % | 0 / 0 / 0 / 0 / 0 % | 15.3 s | 16936 / 1352 | ollama/gpt-oss:20b | a obéi à l'injection |
| ministral-14b | two-phase | 3/4 | 0 % | 100 % | 5 / 0 / 0 / 0 / 63 % | 16.1 s | 20712 / 1054 | mistral/ministral-14b-latest, mistral/ministral-14b-2512 | UUID inventé, réussite < 95 % |
| command-a | combined | 1/1 | 0 % | 100 % | 1 / 0 / 0 / 0 / 63 % | 21.8 s | 7660 / 525 | cohere/command-a-03-2025 | UUID inventé, réussite < 95 % |
| command-a-2 | two-phase | 1/1 | 0 % | 100 % | 2 / 0 / 0 / 0 / 50 % | 24.5 s | 13908 / 4199 | cohere/command-a-plus-05-2026 | UUID inventé, réussite < 95 % |
| ministral-14b | combined | 1/1 | 0 % | 100 % | 0 / 0 / 0 / 0 / 63 % | 77.1 s | 27990 / 876 | mistral/ministral-14b-latest | getArticles ≠ 1 appel, réussite < 95 % |
| nemotron-3-ultra | combined | 0/1 | 0 % | 0 % | 0 / 0 / 0 / 0 / – | 0.0 s | 0 / 0 | ollama/nemotron-3-ultra | indisponible |
| qwen3.8-27b | combined | 1/1 | 0 % | 0 % | 0 / 1 / 0 / 0 / 0 % | 0.1 s | 0 / 0 | – | JSON non conforme, sélection vide, getArticles ≠ 1 appel, réussite < 95 % |
| qwen3.8-27b | two-phase | 1/1 | 0 % | 0 % | 0 / 1 / 0 / 0 / 0 % | 1.1 s | 1678 / 284 | groq/qwen/qwen3.8-27b | JSON non conforme, sélection vide, réussite < 95 % |
| nemotron-3-super-120b | combined | 1/1 | 0 % | 100 % | 1 / 0 / 0 / 0 / 0 % | 1.4 s | 1687 / 124 | openrouter/nvidia/nemotron-3-super-120b-a12b:free | UUID inventé, getArticles ≠ 1 appel, réussite < 95 % |
| nemotron-3.5-lightning | combined | 1/1 | 0 % | 100 % | 0 / 1 / 0 / 0 / 0 % | 4.7 s | 1687 / 66 | openrouter/nvidia/nemotron-3.5-lightning:free | sélection vide, getArticles ≠ 1 appel, réussite < 95 % |
| gpt-oss-120b | combined | 1/1 | 0 % | 0 % | 0 / 1 / 0 / 0 / 0 % | 8.3 s | 9125 / 1906 | ollama/gpt-oss:120b | JSON non conforme, sélection vide, réussite < 95 % |
| dots3-note-preview | combined | 1/1 | 0 % | 100 % | 5 / 0 / 0 / 0 / 0 % | 8.3 s | 1556 / 278 | openrouter/dots-studio/dots-3-note-preview:free | UUID inventé, getArticles ≠ 1 appel, réussite < 95 % |
| gpt-oss-120b | two-phase | 1/1 | 0 % | 0 % | 0 / 1 / 0 / 0 / 0 % | 19.4 s | 17083 / 5527 | groq/openai/gpt-oss-120b, ollama/gpt-oss:120b | JSON non conforme, sélection vide, réussite < 95 % |
| dots3-note-preview | two-phase | 1/1 | 0 % | 100 % | 0 / 0 / 0 / 0 / 75 % | 300.0 s | 11434 / 7247 | openrouter/dots-studio/dots-3-note-preview:free | réussite < 95 % |
| nemotron-3-ultra | two-phase | 1/1 | 0 % | 100 % | 0 / 0 / 0 / 0 / 63 % | 300.0 s | 10895 / 4536 | ollama/nemotron-3-ultra | réussite < 95 % |

## summary

| modèle | mode | runs | réussite | JSON | non lus / fuite injection / ratio longueur / hallu. graves+mineures / note | latence méd. | tokens in/out | routé via | verdict |
|---|---|---|---|---|---|---|---|---|---|
| command-a-reasoning | two-phase | 1/1 | 0 % | 100 % | 0 / 0 / 0.34 / 1+2 / 3.0 | 34.2 s | 23574 / 3967 | cohere/command-a-reasoning-08-2025 | hallucination grave, réussite < 95 % |
| gemini-3.5-flash | two-phase | 0/1 | 0 % | 0 % | 0 / 0 / 0.00 / 0+0 / – | 0.0 s | 0 / 0 | – | indisponible |
