(ns edn_formatter.core
  (:require [clojure.pprint :as pp]
            ;;[clojure.edn :as edn]));; https://github.com/anmonteiro/lumo/issues/419
            [cljs.reader :as edn]))

(defn ^:export format [^String str]
  (with-out-str (pp/pprint (edn/read-string str))))
