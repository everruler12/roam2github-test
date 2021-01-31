(require '[lumo.build.api :as b])

(b/build "src"
  {:main 'edn_formatter.core
   :output-to "edn_formatter.js"
   :optimizations :advanced
   :target :nodejs})