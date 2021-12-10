	      
    /* number and log handling */
    const int = (score, on_error = 0) => parseInt(score) || on_error;
    const float = (score, on_error = 0) => parseFloat(score) || on_error;
    const clog = (text, title = "", color = "green", style = "font-size:12px; font-weight:normal;", headerstyle = "font-size:13px; font-weight:bold;") => {
        let titleStyle = `color:${color}; ${headerstyle} text-decoration:underline;`;
        let textStyle = `color:${color}; ${style}`;
        let output = `%c${title} %c${text}`;
        if (title) {
        console.log(output, titleStyle, textStyle);
        } else {
        output = `%c${text}`;
        console.log(output, textStyle);
        }
    };

	// ASYNC ATTRIBUTE METHODS
	const asw = (() => {
		const setActiveCharacterId = function(charId){
			let oldAcid=getActiveCharacterId();
			let ev = new CustomEvent("message");
			ev.data={"id":"0", "type":"setActiveCharacter", "data":charId};
			self.dispatchEvent(ev);
			return oldAcid;
		};
		const promisifyWorker = (worker, parameters) => {
			let acid=getActiveCharacterId(); 
			let prevAcid=null;               
			return new Promise((res,rej)=>{
				prevAcid=setActiveCharacterId(acid);  
				try {if (worker===0) getAttrs(parameters[0]||[],(v)=>res(v));
					else if (worker===1) setAttrs(parameters[0]||{}, parameters[1]||{},(v)=>res(v));
					else if (worker===2) getSectionIDs(parameters[0]||'',(v)=>res(v));
				} catch(err) {rej(console.error(err))}
			}).finally(()=>setActiveCharacterId(prevAcid));
		}
		return {
			getAttrs(attrArray) {return promisifyWorker(0, [attrArray])},
			setAttrs(attrObj, options) {return promisifyWorker(1, [attrObj, options])},
			getSectionIDs(section) {return promisifyWorker(2, [section])},
			setActiveCharacterId,
		}
	})();

	// Helper function to grab player input
	const getQuery = async (queryText) => {
		const rxGrab = /^0\[(.*)\]\s*$/;
		let rollBase = `! {{query1=[[ 0[${queryText}] ]]}}`, // just a [[0]] roll with an inline tag
			queryRoll = await startRoll(rollBase),
			queryResponse = (queryRoll.results.query1.expression.match(rxGrab) || [])[1]; 
		finishRoll(queryRoll.rollId); // you can just let this time out if you want - we're done with it
		return queryResponse;
	};

	// STRING PARSING METHODS FOR ROLLS
    const rollEscape = {
        chars: { '"': '%quot;', ',': '%comma;', ':': '%colon;', '}': '%rcub;', '{': '%lcub;', },
        escape(str) {
            str = (typeof(str) === 'object') ? JSON.stringify(str) : (typeof(str) === 'string') ? str : null;
            return (str) ? `${str}`.replace(new RegExp(`[${Object.keys(this.chars)}]`, 'g'), (r) => this.chars[r]) : null;
        },
        unescape(str) {
            str = `${str}`.replace(new RegExp(`(${Object.values(this.chars).join('|')})`, 'g'), (r) => Object.entries(this.chars).find(e=>e[1]===r)[0]);
            return JSON.parse(str);
        }
    }

    // Primary Roll, triggered from sheet
    const rollFirst = async (ev, tn) => {
        // We'll pretend we've done a getAttrs on the attacker's weapon for all the required values
        // Row ID's must be provided when using action buttons too, we'll skip all of that here though
		//var evname = ev.htmlAttributes.name;
        clog(`First event: ${JSON.stringify(ev)}`);
        clog(`Event name: ${ev.htmlAttributes.name}`);
        //clog(`Event name: ${evname}`);
        const rollname = (ev.htmlAttributes.name).slice(4); 
        clog(`Roll name: ${rollname}`);

		// GET MODIFIER HERE
		let favoured = await getQuery(`?{Favoured?| Normal,1d12 | Favoured,2d12kh1 | Ill-favoured,2d12kl1}`);
		let modifiers = await getQuery(`?{Modifiers?|0}`);

        const attrs = await asw.getAttrs(["character_name", "favorill", `${rollname}`, `${rollname}_favoured`]);
        const charname = attrs.character_name,
            favill = int(attrs.favourill),
			skillfav = int(attrs[rollname+'_favoured']);
		let basedice = int(attrs[rollname]) + int(modifiers); 
		basedice = basedice < 0 ? 0 : basedice;
        var baseStr = `${basedice}d6`;
		clog(`Character: ${charname}, Base dice: ${basedice}, base string ${baseStr}, modifiers: ${modifiers}, target: ${tn}, favill ${favill}, favoured ${favoured}, skill favoured: ${skillfav}`);
        //for(let i = 1; i <= base; i++) { baseStr += "[[1d6]] "; }
        //for(let i = 1; i <= favour; i++) { stressStr += "[[1d6]] "; }

        let rollBase = `&{template:default} {{character-name=${charname} }} {{roll-name=${rollname} }} {{r1=[[ ${baseStr} + ${favoured} ]] }} {{Target=${tn} }} {{difference=[[0]]}} {{passthroughdata=[[0]]}}`;
        let rollresult = await startRoll(rollBase);
        let rollValue = rollresult.results.r1.result;
        const diff = rollValue - attrs.tn;

		// Storing all the passthrough data required for the next roll in an Object helps for larger rolls
        clog(`Roll result results II: ${JSON.stringify(rollresult.results)}`);
		rollresult.results.difference = rollEscape.escape(diff); 
        clog(`Roll result results II: ${JSON.stringify(rollresult.results)}`);

        //clog(`First roll data: ${JSON.stringify(rollresult)}`);
        //clog(`First roll data rolls: ${JSON.stringify(rollresult.rolls)}`);
		//clog(`Roll data: ${rollEscape.escape(rollData)}`);
        // Storing all the passthrough data required for the next roll in an Object helps for larger rolls

        // Finish the roll, passing the escaped rollData object into the template as computed::passthroughdata
        // Our roll template then inserts that into [butonlabel](~selected|buttonlink||<computed::passthroughdata>)
        // ~selected allows anyone to click the button with their token selected. Omitting this will cause the button
        // to default to whichever character is active in the sandbox when the button is created
        finishRoll(rollresult.rollId, rollresult.results);

		/*
		{
            //passthroughdata: rollEscape.escape({difference: `${diff}` }),
			//character: charname,
			//total: rollValue,
			difference: diff,
        }
		*/
    };

    // The pushroll button still needs its event listener, just like a normal button
    on('clicked:awe clicked:strength clicked:agility clicked:wits clicked:empathy', async (ev) => {
        clog(`Starting first roll`);
        await rollFirst(ev, 14);
        clog(`Completed first roll`);
    });

	// VERSIONING
    // If need for specific data updates with new version then include as a case comparing sheet version with version in the below Switch statement
    on("sheet:opened", () => {
        getAttrs(["sheetversion", "version", "newchar"], (values) => {
            var sheet = float(values.sheetversion),
            actual = float(values.version),
            newchar = int(values.newchar);
            clog(`Versioning; sheet version: ${sheet}, actual: ${actual}, new char: ${newchar}`);

            // Add additional check below, e.g. case newchar != 1 && actual < 2.02
            // In the case statements, call on a separate function to handle data upgrades and other necessary changes
            switch (true) {
                case newchar == 1 :
                    // A new character would always be on the sheet version, no need to bother with upgrades but need to reset the newchar attribute
                    clog(`New character identified. New char: ${newchar}, sheet version: ${sheet}, actual: ${actual}`);
                    setAttrs({
                        version: sheet,
                        newchar: 0,
                        config_notice: 1
                    });
                    break;  
                case actual < sheet :
                    // This can be use as example of upgrade handling, use specific versions in the case logic to handle version specific upgrade of attributes, e.g. actual < 2.10 :
                    // Any upgrade handling needs to be done above this one, and may set the actual variable to be same as sheet to avoid doing the below setAttrs twice.
                    clog(`New version identified. New char: ${newchar}, sheet version: ${sheet}, actual: ${actual}`);
                    // Add reference to upgrade function here, if needed, e.g. upgrade_to_2.24() 
                    setAttrs({
                        version: sheet,
                        newchar: 0,
                        config_notice: 1
                    });
                    // In case an upgrade can be followed by further upgrading, then omit the break at this stage to move down the list of cases
                    break;
            }
        });
    });

    on("change:weapon_load_1 change:weapon_load_2 change:weapon_load_3 change:weapon_load_4 change:weapon_load_5 change:weapon_load_6 change:armourload change:helmload change:shieldload sheet:opened change:treasureload change:fatigue", function() {
	getAttrs(["weapon_load_1","weapon_load_2","weapon_load_3","weapon_load_4","weapon_load_5","weapon_load_6","armourload","shieldload","helmload","fatigue","treasureload"], function(values) {
		let weaponload1 = parseInt(values.weapon_load_1,10)||0;
		let weaponload2 = parseInt(values.weapon_load_2,10)||0;
		let weaponload3 = parseInt(values.weapon_load_3,10)||0;
		let weaponload4 = parseInt(values.weapon_load_4,10)||0;
		let weaponload5 = parseInt(values.weapon_load_5,10)||0;
		let weaponload6 = parseInt(values.weapon_load_6,10)||0;
		let armourload = parseInt(values.armourload,10)||0;
		let shieldload = parseInt(values.shieldload,10)||0;
		let helmload = parseInt(values.helmload,10)||0;
		let fatigue = parseInt(values.fatigue,10)||0;
		let treasureload = parseInt(values.treasureload,10)||0;
		let loadfatigue = armourload + shieldload + helmload + weaponload1 + weaponload2 + weaponload3 + weaponload4 + weaponload5 + weaponload6 + treasureload + fatigue;
		setAttrs({
			load: loadfatigue,
		});
	});
});
    on("change:weary sheet:opened", function() {
	getAttrs(["weary"], function(values) {
		let weary = values.weary||0;
		if (weary == 0) {
			wearytype = "normal";
		}
		else {
			wearytype = "weary";
		}

		setAttrs({
			wearytype: wearytype,
		});
	});
});
    on("change:awe_favoured sheet:opened", function() {
	getAttrs(["awe_favoured"], function(values) {
		let faved = values.awe_favoured||0;
		if (faved == 0) {
			favtype = 0;
		}
		else {
			favtype = 1;
		}

		setAttrs({
			awe_fav: favtype,
		});
	});
});

    on("change:athletics_favoured sheet:opened", function() {
	getAttrs(["athletics_favoured"], function(values) {
		let faved = values.athletics_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			athletics_fav: favtype,
		});
	});
});

    on("change:awareness_favoured sheet:opened", function() {
	getAttrs(["awareness_favoured"], function(values) {
		let faved = values.awareness_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			awareness_fav: favtype,
		});
	});
});

    on("change:hunting_favoured sheet:opened", function() {
	getAttrs(["hunting_favoured"], function(values) {
		let faved = values.hunting_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			hunting_fav: favtype,
		});
	});
});

    on("change:song_favoured sheet:opened", function() {
	getAttrs(["song_favoured"], function(values) {
		let faved = values.song_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			song_fav: favtype,
		});
	});
});

    on("change:craft_favoured sheet:opened", function() {
	getAttrs(["craft_favoured"], function(values) {
		let faved = values.craft_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			craft_fav: favtype,
		});
	});
});

    on("change:enhearten_favoured sheet:opened", function() {
	getAttrs(["enhearten_favoured"], function(values) {
		let faved = values.enhearten_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			enhearten_fav: favtype,
		});
	});
});

    on("change:travel_favoured sheet:opened", function() {
	getAttrs(["travel_favoured"], function(values) {
		let faved = values.travel_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			travel_fav: favtype,
		});
	});
});

    on("change:insight_favoured sheet:opened", function() {
	getAttrs(["insight_favoured"], function(values) {
		let faved = values.insight_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			insight_fav: favtype,
		});
	});
});

    on("change:healing_favoured sheet:opened", function() {
	getAttrs(["healing_favoured"], function(values) {
		let faved = values.healing_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			healing_fav: favtype,
		});
	});
});

    on("change:courtesy_favoured sheet:opened", function() {
	getAttrs(["courtesy_favoured"], function(values) {
		let faved = values.courtesy_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			courtesy_fav: favtype,
		});
	});
});

    on("change:battle_favoured sheet:opened", function() {
	getAttrs(["battle_favoured"], function(values) {
		let faved = values.battle_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			battle_fav: favtype,
		});
	});
});

    on("change:persuade_favoured sheet:opened", function() {
	getAttrs(["persuade_favoured"], function(values) {
		let faved = values.persuade_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			persuade_fav: favtype,
		});
	});
});

    on("change:stealth_favoured sheet:opened", function() {
	getAttrs(["stealth_favoured"], function(values) {
		let faved = values.stealth_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			stealth_fav: favtype,
		});
	});
});

    on("change:scan_favoured sheet:opened", function() {
	getAttrs(["scan_favoured"], function(values) {
		let faved = values.scan_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			scan_fav: favtype,
		});
	});
});

    on("change:explore_favoured sheet:opened", function() {
	getAttrs(["explore_favoured"], function(values) {
		let faved = values.explore_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			explore_fav: favtype,
		});
	});
});

    on("change:riddle_favoured sheet:opened", function() {
	getAttrs(["riddle_favoured"], function(values) {
		let faved = values.riddle_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			riddle_fav: favtype,
		});
	});
});

    on("change:lore_favoured sheet:opened", function() {
	getAttrs(["lore_favoured"], function(values) {
		let faved = values.lore_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			lore_fav: favtype,
		});
	});
});

    on("change:valour_favoured sheet:opened", function() {
	getAttrs(["valour_favoured"], function(values) {
		let faved = values.valour_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			valour_fav: favtype,
		});
	});
});

    on("change:wisdom_favoured sheet:opened", function() {
	getAttrs(["wisdom_favoured"], function(values) {
		let faved = values.wisdom_favoured||0;
		if (faved == 0) {
			favtype = "normal";
		}
		else {
			favtype = "favoured";
		}

		setAttrs({
			wisdom_fav: favtype,
		});
	});
});