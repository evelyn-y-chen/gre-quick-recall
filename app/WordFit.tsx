"use client";
import {useEffect} from "react";
import {observeWordFit} from "./wordFitObserver";
/** Keep English word labels intact; fit only labels, never meanings or notes. */
export default function WordFit(){
 useEffect(()=>observeWordFit(),[]);
 return null;
}
