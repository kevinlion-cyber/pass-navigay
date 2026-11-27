# Événements de la semaine (automatique)

Branche réservée aux données : chaque lundi, la tâche planifiée de Claude remplace
`evenements/semaine.json` (format `passnavigay-evenements-v1`). La fonction Supabase
`import-evenements-hebdo` le récupère (lundi 7 h 15 et 10 h 15 UTC) et l'ajoute en
attente dans Admin → Événements à valider. Rien n'est publié sans validation.

Ne pas fusionner cette branche dans `main`.
