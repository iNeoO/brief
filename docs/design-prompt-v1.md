# Prompt — charte graphique v1 (page d'accueil)

## Rôle

Directeur artistique. Tu conçois des interfaces éditoriales sobres, faites pour être lues.

## Produit

Une application de news qui envoie un condensé quotidien : chaque matin, un résumé par sujet
suivi, quelques minutes à lire — ou à écouter, chaque résumé existant aussi en audio.
Promesse : *savoir l'essentiel de la journée sans y passer la matinée.*

Public grand public, pas technique. On parle matin, sujets, résumé, écoute, quelques minutes.
Jamais de flux, de pipeline, d'IA ni d'agrégation.

Deux contraintes de contexte :

- Le nom « brief » va changer → le logo est un mot posé en typographie, remplaçable en une
  ligne. Pas de symbole, pas de monogramme.
- Très peu de contenu publié aujourd'hui → une page avec quatre sujets doit sembler finie,
  jamais en attente de remplissage.

## Ton

Sobre, calme, éditorial — un journal bien composé. Hiérarchie nette, beaucoup de blanc, peu de
couleurs, aucune décoration qui n'aide pas à lire. À l'opposé d'une landing SaaS à dégradés.

## Livrable

Un seul fichier HTML autonome (CSS en ligne, aucune ressource externe, polices système) :

1. **Trois directions de charte** côte à côte en haut : nom, palette avec valeurs hex, couple
   typographique, une phrase de parti pris. Réellement différentes, pas trois nuances de gris.
2. **La page d'accueil entièrement composée** dans celle que tu recommandes, avec deux lignes
   qui disent pourquoi celle-là.
3. **Les tokens CSS** de cette direction, en bloc à copier : couleurs, échelle typographique,
   espacements, rayons.
4. **Les composants dans leurs états** : bouton principal et secondaire (repos, survol, focus
   clavier, chargement), lien, carte de sujet, en-tête, pied de page.

## Contraintes

- Une seule couleur d'accent ; rouge et vert réservés à l'erreur et au succès.
- Deux familles typographiques au maximum, cinq tailles, corps à 17–18 px, interligne généreux.
- Texte courant : jamais plus de ~70 caractères par ligne.
- Modes clair et sombre, les deux traités sérieusement — pas une inversion mécanique.
- WCAG AA, focus clavier visible partout, aucune information portée par la couleur seule.
- Mobile d'abord, zones tactiles ≥ 44 px.
- Interface en français, vouvoiement, pas de point d'exclamation.

## La page

- **En-tête** : mot-logo, lien « Se connecter », bouton « S'inscrire ».
- **Ouverture** : la promesse en une phrase courte, une sous-phrase qui la précise, un bouton
  « Commencer », et la mention du rythme (un envoi par matin, rien d'autre).
- **Le brief du jour**, pièce centrale : quatre sujets, chacun avec son nom, la date, la durée
  de lecture, les deux ou trois premières phrases du résumé, un bouton d'écoute et un lien
  « Lire le brief ». Écris de vraies phrases plausibles, pas de faux latin. Montre aussi
  l'état où le brief du jour n'est pas encore paru.
- **Comment ça marche**, en trois temps : vous choisissez vos sujets → on lit la presse pour
  vous → vous recevez un résumé chaque matin. Sans illustrations.
- **Les sujets disponibles** : Technologie, Économie, International, Sciences, Culture, Sport.
- **Clôture** avec le bouton d'inscription, puis un pied de page discret (mentions légales,
  confidentialité, contact).

## À éviter

Dégradés, ombres marquées, effets de verre, animations décoratives, emojis, illustrations de
banque d'images, mockups en perspective, faux chiffres ou témoignages, logos « ils nous font
confiance », bandeaux d'urgence, jargon technique, promesses d'IA.

Premier jet : propose directement, on itérera dessus.
