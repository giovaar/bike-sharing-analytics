# Bike Sharing Analytics

Dashboard interactivo de los alquileres históricos de **Capital Bikeshare en Washington D. C. (2011–2012)**. Explora **17 379 horas observadas** y **3 292 679 alquileres** con datos estáticos. La demo funciona en el navegador y sus escenarios corresponden a una evaluación histórica.

## Qué puedes explorar

- Resumen de alquileres, media por hora observada, pico horario y cobertura.
- Demanda diaria, mensual y por hora, con un mapa de calor por día de la semana.
- Alquileres casuales y registrados, participación y perfiles horarios.
- Demanda media por condición climática y por intervalo de temperatura normalizada, con el tamaño de cada muestra.
- Cobertura mensual, 165 horas de calendario sin registro y comprobaciones del dataset.
- Clasificación y regresión académicas, comparación temporal de dos regresores y un explorador de 2 168 horas de prueba con valores observados, estimaciones y errores absolutos.

Los filtros de fechas, tipo de día y clima se aplican a los paneles exploratorios. La calidad usa meses completos dentro del intervalo seleccionado y las métricas de evaluación corresponden a corridas fijas. Las horas ausentes no se rellenan con ceros.

## Ejecutar localmente

Requisitos de la app: Node.js 22.18 o posterior y npm. Stack: React, TypeScript, Vite, Recharts, CSS y ESLint. Los scripts de preparación histórica usan Python 3.13.7.

~~~sh
cd web
npm ci
npm run dev -- --host 127.0.0.1
~~~

Abre la URL impresa por Vite. Desde el mismo directorio puedes verificar y compilar:

~~~sh
npm run typecheck
npm test
npm run lint
npm run build
npm run test:build
npm run preview -- --host 127.0.0.1
~~~

La compilación se genera en `web/dist/`. El build usa una base relativa para funcionar en un subdirectorio. El repositorio queda preparado para GitHub Pages con activación manual. [Instrucciones y revisión de publicación](docs/PUBLICATION.md)

## Metodología y alcance

La evaluación académica reproducida usó partición aleatoria 80/20, con estratificación para clasificación. El Random Forest Regressor obtuvo R² **0,9448**, MAE **24,72** y RMSE **41,80**. La evaluación temporal entrenó con los registros anteriores a octubre de 2012 y probó sobre las horas observadas de octubre a diciembre de ese año. Sus resultados representan un trimestre, una ciudad y condiciones meteorológicas observadas.

| Evaluación temporal | R² | MAE | RMSE |
| --- | ---: | ---: | ---: |
| Random Forest Regressor | 0,8721 | 46,75 | 72,10 |
| Media histórica por hora y tipo de día | 0,6481 | 79,95 | 119,59 |

MAE y RMSE se expresan en alquileres por hora. R² es adimensional. Los dos protocolos usan conjuntos de prueba distintos. El explorador muestra estimaciones precalculadas para esas horas históricas, con cobertura limitada a las observaciones disponibles.

## Datos, licencias y créditos

**Datos:** Hadi Fanaee-T (2013), *Bike Sharing*, UCI Machine Learning Repository, DOI **10.24432/C5W894**, licencia **CC BY 4.0**. La proyección para la web reorganiza y reduce las columnas del dataset. También se cita el trabajo de Fanaee-T y João Gama, *Event labeling combining ensemble detectors and background knowledge*, DOI **10.1007/s13748-013-0040-3**. [Dataset y licencia en UCI](https://archive.ics.uci.edu/dataset/275/bike-sharing-dataset)

**Proyecto académico:** desarrollado en equipo en la Universidad Tecnológica de Panamá por David Delgado, Jeshuath Hernández, Johan Cerrud y Giovanny Arpaia. La aplicación web y el flujo reproducible se desarrollaron posteriormente sobre ese trabajo. [Roles del equipo](CONTRIBUTORS.md)

Los avisos de las dependencias de la aplicación se incluyen en [THIRD_PARTY_NOTICES.txt](web/public/THIRD_PARTY_NOTICES.txt). La licencia del dataset cubre los datos. El equipo autorizó publicar la [edición pública del proyecto académico](academic/README.md). La licencia del código se considera por separado. En la copia local se conservan por separado las referencias académicas y los resultados reproducidos. [Propuesta para el portafolio](docs/PORTFOLIO.md)
