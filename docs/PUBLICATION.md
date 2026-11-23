# Revisión y publicación en GitHub Pages

## Revisar antes de crear el repositorio

El equipo confirmó la publicación de su trabajo académico. La edición pública conserva notebooks, artículo, figuras y datos de UCI con las redacciones documentadas. La licencia del código se acuerda por separado. La atribución CC BY 4.0 de UCI aplica a los datos y su proyección. Las dependencias conservan sus propias licencias. Esta preparación no concede derechos sobre el PBIX, documentos académicos ni otros materiales del equipo.

La lista prevista incluye README, créditos sin datos de contacto, esta guía, la propuesta de portafolio, el workflow, el exportador histórico y el código, pruebas y datos revisados de `web/`. La compilación debe contener solo `index.html`, `assets/`, el aviso de licencias y los cinco archivos de datos verificados. Permanecen locales los originales sin redactar, documentos de auditoría, consigna universitaria, PBIX, CSV de Power BI, mapa y Excel de Panamá, cachés, entornos y artefactos de entrenamiento. No incluyas correos institucionales en el contenido ni en la identidad pública de Git. GitHub ofrece una dirección noreply en la configuración de correo.

## Preparar el repositorio después de aprobar la publicación

Ejecuta primero todas las comprobaciones del README. Si la carpeta aún carece de repositorio Git, desde la raíz:

~~~sh
git init -b main
git add -- .gitignore README.md CONTRIBUTORS.md docs/PUBLICATION.md docs/PORTFOLIO.md scripts/export_historical_scenarios.py .github/workflows/pages.yml academic web
git diff --cached --name-only
git diff --cached --stat
~~~

Revisa la lista y el contenido antes de generar el commit. Incluye el archivo de licencia acordado si se ha creado. En GitHub crea un repositorio público vacío llamado `bike-sharing-analytics`, sin README generado automáticamente. Sustituye `TU_USUARIO` por el nombre real:

~~~sh
git commit -m "Publish Bike Sharing Analytics demo source"
git remote add origin https://github.com/TU_USUARIO/bike-sharing-analytics.git
git push -u origin main
~~~

1. En el repositorio, abre **Settings → Pages** y selecciona **GitHub Actions** en **Source**.
2. Ve a **Actions → Publicar demo en GitHub Pages → Run workflow**, elige `main` y ejecuta el flujo. El workflow solo se dispara manualmente.
3. Comprueba que pasen typecheck, pruebas, lint, compilación y verificación del subdirectorio. El workflow sube únicamente `web/dist` como artefacto de Pages.
4. Abre la URL que muestra el trabajo de despliegue. Prueba el cambio de sección, un filtro, una selección vacía y una fecha del explorador en escritorio y móvil. Guarda capturas de esa misma compilación si se van a usar en el portafolio.

URL prevista con un repositorio de ese nombre: `https://TU_USUARIO.github.io/bike-sharing-analytics/`. GitHub Pages ofrece esta opción en repositorios públicos con GitHub Free. [Configuración oficial de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Reproducir el archivo de escenarios en la copia local

Desde la raíz, con los resultados preservados de la Fase 2A:

~~~powershell
.\.venv\Scripts\python.exe -B scripts/export_historical_scenarios.py --predictions artifacts/temporal-2a-n25bjws9/predicciones_prueba.csv --metrics artifacts/temporal-2a-n25bjws9/metrics.json --check
~~~

El modo `--check` compara la salida byte por byte. Al omitirlo, el script genera un archivo nuevo únicamente si todavía no existe. El exportador verifica la huella del CSV fuente, las observaciones, la referencia por hora y tipo de día y las métricas de ambos modelos. La compilación web consume el resultado estático y se puede ejecutar con npm en un clon público.
