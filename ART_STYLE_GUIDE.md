# CYBER - guia de estilo de arte (NEON PROTOCOL)

Referencia travada de estilo visual pra qualquer arte gerada por IA pro jogo
(personagens, e futuramente predios/props/tiles). Nao mexe em nenhum
codigo/mecanica - isso e so o texto que orienta a geracao das imagens.
Enquanto os arquivos de imagem reais nao chegam (upload direto no repo,
formato png), o jogo continua usando os retangulos placeholder de
src/render/renderer.js e src/character/characterRenderer.js.

## MASTER STYLE LOCK

Repete isso (verbatim) em toda geracao de personagem novo, pra manter a
mesma familia visual entre eles:

```
MASTER STYLE LOCK — DO NOT IGNORE

This character belongs to the same original 2D cyberpunk RPG universe called NEON PROTOCOL.

Create the artwork in highly polished handcrafted pixel art.

VISUAL LANGUAGE:

- premium 2D pixel-art RPG character art
- authentic Game Boy Advance / early 32-bit handheld RPG aesthetic
- strong dark outlines
- clearly visible square pixels
- intentional pixel clusters
- controlled dithering
- block-based pixel shading
- limited but rich color palette
- carefully placed highlights
- clean readable silhouettes
- detailed but never visually noisy

Do NOT create:

- smooth digital painting
- semi-realistic anime illustration
- photorealism
- 3D rendering
- soft gradients
- airbrush shading
- blurry pixels
- anti-aliased edges
- painterly textures
- excessive glow or bloom

==================================================
COLLECTION CONSISTENCY
==================================================

Every character must look like it was designed by the exact same pixel artist for the exact same game.

Maintain identical:

- pixel density
- pixel size
- outline thickness
- shading language
- lighting logic
- facial rendering complexity
- clothing rendering complexity
- color depth
- proportions
- visual production quality

The characters must NOT look like skins of one another.

Each class must preserve its own:

- face
- hairstyle
- silhouette
- clothing architecture
- equipment
- signature accessories
- profession
- accent color

==================================================
CHARACTER PROPORTIONS
==================================================

Use stylized RPG proportions inspired by premium GBA-era character sprites.

Slightly oversized head.

Compact torso.

Readable hands and feet.

Clean silhouette.

Avoid realistic human proportions.

Avoid chibi proportions that are excessively small or childish.

The character should feel like a playable RPG protagonist.

==================================================
PIXEL GRID
==================================================

Design everything as true pixel art.

Every line, curve, shadow and highlight must follow a visible pixel grid.

Edges must be stepped and deliberate.

Do not simulate pixel art by applying a pixel filter to smooth artwork.

Hair must be constructed from readable pixel clusters.

Clothing folds must use block-shaped pixel shadows.

Metal should use small controlled highlights.

Neon technology should use very small bright pixel accents rather than soft glowing gradients.

==================================================
COLOR PHILOSOPHY
==================================================

The shared world palette is based on:

- black
- charcoal
- deep navy
- muted violet
- desaturated blue-gray
- controlled cyan
- controlled magenta
- class-specific accent colors

Background and clothing should remain mostly dark.

Bright colors should be reserved for:

- technology
- eyes
- small cybernetic components
- class accent details
- important equipment

Never allow neon colors to dominate the entire character.

==================================================
CYBERPUNK DESIGN LANGUAGE
==================================================

Technology should feel practical and integrated into clothing.

Use details such as:

- small electronic modules
- subtle illuminated seams
- compact cybernetic devices
- communication hardware
- mechanical fasteners
- modular straps
- data ports
- technical fabric panels
- small status lights

Avoid random futuristic decoration.

Every technological detail should look like it has a functional purpose.

==================================================
WORLD CONSISTENCY
==================================================

All characters belong to the same dark cyberpunk city.

The world contains:

- underground hackers
- corporate surveillance
- megacorporations
- black markets
- robotics workshops
- encrypted networks
- industrial districts
- neon nightlife
- cybernetic augmentation
- digital espionage

Characters from different classes should represent different areas of this same society.

==================================================
QUALITY RULE
==================================================

The finished artwork must feel like production-ready game art, not concept art.

It must remain visually readable at small size.

Important character features must remain recognizable at thumbnail scale.

Prioritize:

1. silhouette
2. face
3. hairstyle
4. class-defining equipment
5. signature color
6. secondary details

Do not sacrifice readability for unnecessary complexity.

==================================================
NO TEXT
==================================================

Unless explicitly requested:

NO text.
NO character name.
NO class name.
NO logo.
NO HUD.
NO game menu.
NO watermark.
NO decorative frame.
```

## Personagem 1 - Shadow Hacker (aprovado, referencia final)

Prompt que gerou a imagem aprovada pelo usuario (portrait, chest-up):

```
Create CHARACTER 01 — SHADOW HACKER.

Follow the MASTER STYLE LOCK exactly.

Character identity:
A young male underground hacker with a slim agile build, mysterious presence and stealth-oriented design.

Face:
Youthful male face.
Sharp intense blue eyes.
Focused, cautious, intelligent expression.

Hair:
Messy dark navy-black hair.
Layered bangs falling across the forehead.
Soft blue-violet highlights from ambient neon light.

Signature features:
Large dark hood framing the head.
Sleek matte-black tactical face mask covering the lower half of the face.
Subtle cyan cyber-light detail near the cheek and mask.

Clothing:
Dark stealth-tech jacket in black, charcoal, deep navy and muted violet.
Compact tactical shoulder straps.
Subtle cyan illuminated details.
Lightweight hacker-oriented outfit, not heavy military armor.

Color identity:
Purple, deep navy, black, cyan.

Mood:
Stealth, intrusion, digital espionage, underground cybercrime, anonymity.

Background:
Dark hacker room or data den with subtle cyberpunk lighting, monitors and server atmosphere, but kept secondary.

This character should immediately communicate:
silent infiltration, extraction, disappearing into the network.
```

Essa imagem (chest-up, retrato) e a identidade oficial do Shadow Hacker.

Corpo inteiro de frente (idle) tambem ja aprovado, gerado com esse prompt
adicional (mesmo Master Style Lock + a identidade acima + pose):

```
Create CHARACTER 01 — SHADOW HACKER, full body reference sheet pose.

Pose:
Full body, standing straight, facing directly forward toward the camera, arms relaxed at the sides, feet shoulder-width apart. Plain dark background, no scenery, no other objects, single isolated character reference pose.
```

## CHARACTER POSE CONSISTENCY LOCK

Pra gerar as outras poses (costas, lado) sem o personagem "mudar de
pessoa", usar esse segundo bloco junto do Master Style Lock, **e anexar a
imagem de frente ja aprovada como referencia real no Gemini** (nao so
descrever ela de novo em texto - esse bloco assume que a imagem foi
anexada):

```
CHARACTER POSE CONSISTENCY LOCK — CRITICAL

The supplied character reference is the canonical identity reference.

Do NOT redesign the character when changing poses.

Preserve exactly:

- same apparent age
- same gender presentation
- same skin tone
- same head proportions
- same face shape
- same hairstyle
- same hair color
- same eye color
- same clothing
- same accessories
- same equipment
- same accent colors
- same pixel density
- same outline thickness
- same shading complexity

Only the camera-facing direction and body pose may change.

The character must remain immediately recognizable as the same individual in every pose.

Keep the same body proportions and sprite scale across all views.

Do not add accessories that are not visible in the canonical design.
Do not remove permanent design elements.
Do not randomly change clothing details.
Do not change hairstyle length or shape.
Do not change colors between poses.

When an object becomes hidden because of perspective, place it naturally on the correct side of the body rather than deleting or redesigning it.

All poses must align as part of one professional game sprite sheet.
```

E fecha pedindo a pose especifica, um bloco por vez:

```
POSE REQUEST:

Create the FRONT VIEW.

Character standing upright.
Neutral idle stance.
Arms relaxed naturally.
Head facing directly forward.
Both feet aligned.
No action pose.
```

```
POSE REQUEST:

Create the BACK VIEW.

Exact same character.
Exact same proportions and equipment.
Camera directly behind the character.
Show the rear construction of the hairstyle, jacket, hood and equipment correctly.
Neutral idle stance.
```

```
POSE REQUEST:

Create the LEFT SIDE VIEW.

Exact 90-degree left-facing profile.
Same character scale.
Same clothing and equipment.
Neutral idle stance.
```

Nota: o jogo so precisa de frente, costas e **um** lado - a direcao
"right" e sempre a de "left" espelhada em tempo de render (ver
CYBER_SPEC.md e src/character/spriteSheet.js), nunca um asset separado.
Gerar a "RIGHT SIDE VIEW" tambem nao atrapalha, so nao e necessaria pro
jogo.

Ainda faltam, nesse mesmo estilo:

- Costas e lado do personagem 1 (prompts acima prontos, faltando gerar).
- Poses de caminhada (passo 1 e passo 2) pra cada direcao - mesmo
  esquema de Pose Consistency Lock, pedindo "walking pose, mid-stride"
  em vez de "neutral idle stance".
- Personagens 2, 3 e 4 (outras classes/NFTs escolhiveis), cada um com sua
  propria cor de destaque, silhueta e acessorio de assinatura, seguindo o
  mesmo MASTER STYLE LOCK.

## Pendencia

Nenhum arquivo de imagem real foi commitado ainda - as imagens geradas ate
agora foram coladas no chat, sem virar arquivo de verdade. Pra integrar de
verdade no jogo, subir os PNGs em `art_wip/` (upload direto pelo GitHub,
"Add file -> Upload files") pra virarem arquivos git de verdade.
