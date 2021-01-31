(ns edn_formatter.core
  (:require [clojure.pprint :as pp]
            ;;[clojure.edn :as edn])) ;; https://github.com/anmonteiro/lumo/issues/419
            [cljs.reader :as edn]))

(defn ^:export format [^String str]
  (with-out-str (pp/pprint (edn/read-string str))))

;; pprint
;;  https://clojuredocs.org/clojure.pprint/pprint

;; export
;;  https://clojurescript.org/reference/advanced-compilation#access-from-javascript
;;  https://stackoverflow.com/a/26935889
;;  redundant? https://stackoverflow.com/a/31643787

;; read-string
;;  https://clojuredocs.org/clojure.edn/read-string
;;  use cljs.reader instead, see above

;; with-out-str
;;  https://stackoverflow.com/questions/32107313/pretty-print-to-a-string-in-clojurescript


;; build
;; lumo --classpath src build.cljs
;;  https://anmonteiro.com/2017/02/compiling-clojurescript-projects-without-the-jvm/