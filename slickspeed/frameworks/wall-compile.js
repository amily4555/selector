//wind css3 selector engine.
var veryQuery = (function(window, undefined) {
	var document = window.document,
		version = '1.0',
		name = 'vero',
		support = {
			isIE678: !!(window.ActiveXObject && !document.addEventListener),
			hasByName: !!document.getElementsByName,
			hasDocPos: !!document.compareDocumentPosition
		},
		template = {};

	(function(){
		var d = document.createElement('div'), id = (new Date()).getTime();
		d.innerHTML = '<a name="d"></a><div id="d"></div>';
		support.hasByTagID = d.getElementsByTagName('*')["d"] === d.lastChild;
		support.hasByElement = !!d.firstElementChild;
		support.hasByChildren = !!d.children;

		d.innerHTML = '<div class="t e"></div><div class="t"></div>';
		d.lastChild.className = 'e';
		support.hasTextContent = ('textContent' in d);
		support.hasByClass = d.getElementsByClassName && d.getElementsByClassName('e').length == 2;

		support.hasElementPos = support.hasByElement && support.hasDocPos;
		support.hasChildrenTag = support.hasByChildren && !!document.documentElement.children.tags;

		d.innerHTML = '<a name="' + id + '" class="€ b"></a>';
		d.appendChild(document.createComment(''));
		support.hasTagComment = (d.getElementsByTagName('*').length > 1);
		// Safari can't handle uppercase or unicode characters when in quirks mode.
		support.hasQsa = !!(d.querySelectorAll && d.querySelectorAll('.€').length);

		var root = document.documentElement;
		root.insertBefore(d, root.firstChild);
		// IE returns named nodes for getElementById(name)
		support.hasIdAddsName = !!(document.getElementById(id));
		root.removeChild(d);
		d = null;
	})();

	var chunker = /(?:\[\s*([^='"~\s\]]*[^='"~\s~^$|*!])(?:\s*([~^$|*!]?=)\s*(['"]?)(.*?)\3)?\s*\])|((?:\.|#|:|::)?)([\w\u00A1-\uFFFF-]+|\*)(?:\((\([^()]+\)|[^()]+)+\))?([\w\u00A1-\uFFFF-]*)?|(?:\s*([~+>,\s])\s*)/g,
		rMatchPos = /([+\-]?)(\d*)(?:n([+\-]?\d*))?/,
		cid = 0,
		order = {
			':root': 10,
			'+': 10,
			'#': 0,
			'>T': support.hasChildrenTag ? 8 : 0,
			'N': support.hasByName ? 7 : 0,
			'.': support.hasByClass ? 6 : 0,
			'>': 6,
			'~': 5,
			'T': 5,
			':checked': 4,
			':enabled': 4,
			':disabled': 4,
			':link': 3,
			':visited': 3,
			' ': 0,
			'*': 0
		},
		testOrder = {
			'#': 9,
			'=': 9,
			'[': 8,
			'N': 9,
			'T': 8,
			'.': 5,
			'~=': 3,
			'|=': 3,
			'*=': 3,
			':not': 6,
			':has': 1,
			':contains': 3,
			':nth-child': 2,
			':nth-last-child': 2,
			':first-child': 3,
			':last-child': 3,
			':only-child': 3,
			':not-ex': 7
		},
		checker = {
			'#': 1,
			'T': 1,
			'.': 1,
			'N': 1,
			':element': 1,
			'*': 1,
			'>T': 1,
			'+': support.hasByElement ? 1 : 0,
			'~': support.hasByElement ? 1 : 0
		},
		testSorter = function ( a, b ){
			return a.$tr - b.$tr;
		};

	function compile( expr, strict ) {
		var group = parse( expr ),
			len = group.length;
		//console.log(group.slice(0));
		//console.log(">>>>>>>>>>>>>>>>>");
		if ( strict ) {
			order[ '#' ] = 9;
		}

		while ( len-- ) {
			var chain  = group[ len ],
				code = build( chain );
			//console.log(chain);
			//console.log(code.slice(0));

			var hash = {},
				pres = [],
				posts = [];

			code = code.replace(/\/\*\^(.*?)\^\*\//g, function (m, p){
				return (hash[p] || (hash[p] = pres.push(p)), '');
			});
			code = code.replace(/\/\*\$(.*?)\$\*\//g, function (m, p){
				return (hash[p] || (hash[p] = posts.push(p)), '');
			});
			code = format(template.main, { X: pres.join('') + code + posts.join('') });
			//code = js_format(code);
			group[len] = new Function('query', 'return(' + code + ')')(query);
			//debug.code(code);
			//console.log('**********************\n\n');
		}

		if (group.length == 1) {
            return group[0];
        }
        return function (root){
            var k = group.length;
            var rs = [];
            while (k--) {
                rs.push.apply(rs, group[k](root));
            }
            return rs;
        }
	}

	//parse selector to internal format
	var parse = function() {
		var text, index;

		function error() { 
			throw ['SyntaxError', text,  "index: " + (index - 1)]; 
		}

		function match( regex ) {
			var mc = ( regex.lastIndex = index, regex.exec(text) );
			return mc && mc.index == index ? (index = regex.lastIndex, mc) : null;
		}

		function parse() {
			var m, q = [], c = [q], g = [c];

			while ( (m = match(chunker)) !== null ) {
				//[ ~+>,]分组与位置关系
				if ( m[9] ) {
					if ( m[9] == "," ) {
						//以,开始的或者连续多个,的selector不符合语法
						c.length == 1 && q.length == 0 && error();
						g.push(c = [ q = [] ]);
					} else {
						//连续多个~+>的selector不符合语法
						q.length == 0 && q.$union && error();
						c.length == 1 && q.length && (q.$union = q.$union || " ");
						(c.length > 1 || c.length == 1 && q.length) && c.push(q = []);
						q.$union = m[9].replace(/\s/g, " ");
					}
				}
				//attribute [attr='xxx']
				else if ( m[1] ) {
					//[attr='xxx']
					if ( m[2] && typeof( m[4] ) != 'undefined' ) {
						q.push( make(m[2], [m[1], m[4]]) );
					}
					//[attr]
					else {
						q.push( make("[", [m[1]]) );
					}
				}
				//.class #ID :pseduo
				else if ( m[6] ) {
					if (m[5]) {
						//.class | #id
						if ( m[5].indexOf(":") === -1 ) {
							q.push( make(m[5], [m[6]]) );
						}
						//[:|::]pseduo
						else {
							//invalid/unsupported pseduo
							m[8] || !(true) && error();
							if ( m[7] ) {
								if (m[6] == 'not' || m[6] == 'has') {
									var _i = index, _t = text;
									(index = 0, text = text.slice(_i - m[7].length - 1, _i - 1));
									q.push( make(m[5]+m[6], [parse(), text]) );
									(index = _i + 1, text = _t);
								} else {
									q.push( make(m[5]+m[6], [m[7]]) );
								}
							} else {
								q.push( make(m[5]+m[6], m[5] == '::' ? [m[5]+m[6]] : [m[6]]) );
							}
						}
					} else {
						q.push( make("T", [m[6]]) );
					}
				}
			}

			return g;
		}

		return function( selector ) {
			( text = selector, index = 0, selector = parse() );
			return ( match(/\s*/g), index < text.length ) ? error() : selector;
		};
	}();

	function make( kind, array ) {
		return ( array.$kind = kind, array );
	}

	function format( template, props ) {
		return template.replace(/\$\{([^\}]+)\}/g, function(m, p) {
			 return props[p] == null ? m : props[p] + '';
		});
	}

	//clean-up selector
	//1. merge attributes/class etc.
	//2. sort selector order for testing.
	//3. caculte the fast selector
	function clean( q ) {
		var i = 0, s, t, f, index, classes;

		for ( ; s = q[i]; i++ ) {
			switch ( s.$kind ) {
				//:html ==> tag:html
				case ':html':
					s = make('T', ['html']);
					break;
				case '=':
					if ( s[1] ) {
						//[name='xxx'] ===> getElementsByName('xxx')
						if ( s[0] === 'name' ) {
							s = make( 'N', [s[1]] );
						}
						//[id='xxx'] ==> #xxx
						else if ( s[0] === 'id' ) {
							s = make( '#', [s[1]] );
						}
					}
					break;
				//[class~="xxx"] ===> .xxx
				//[className~="xxx"] ===> .xxx
				case '~=':
					if ( s[1] && s[0] === 'class' || s[0] === 'className' ) {
						s = make( '.', [s[1]] );
					}
					break;
				case 'T':
					//*.class | *[xxx]
					if ( s[0] === '*' ) {
						s.$kind = '*';
					} else if ( q.$union == '>' ) {
						//>T
						q.$tag = i;
					}
					break;
				//:not(expr) ===> :not-ex(expr)
				case ':not':
					if ( !((t=s[0], t.length == 1) && (t=t[0], t.length == 1)) ) {
						s.$kind = ':not-ex';
					}
					break;
			}

			//merge .class.class2
			if ( s.$kind === '.' ) {
				if ( !classes ) {
					classes = s;
				} else {
					classes.push( s[0] );
					s.$kind = '*';
					q.splice( i--, 1 );
				}
			}

			s.$pri =  order[s.$kind] | 0;
			s.$tr = testOrder[s.$kind] | 0;

			//find the fast selector for sorting and testing
			if ( !f || s.$pri > f.$pri ) {
				f = s;
				index = i;
			}

			if ( s.$kind !== '*' ) {
				q[i] = s;
			}
		}

		q.sort( testSorter );

		return ( q.$ = f, q.$index = index, q );
	}

	//compute and clean-up selector chain
	function compute( chain ) {
		var seq,
			part,
			seed,
			tag,
			len = chain.length,
			i = 0,
			j = 0;

		for ( ; i < len; i++ ) {
			seq = chain[i];
			seq = clean( seq );
			seq.N = '_n' + i;
			part = chain[ i - 1 ];
			seq.R = part ? part.N : 'root';

			if ( !seed || seq.$.$pri >= seed.$pri ) {
				seed = seq.$;
				chain.$index = i;
			}
		}

		j = chain.$index === 0 ? 0 : chain.$index + 1;
		chain[0].$first = true;

		for ( ; j < len; j++ ) {
			seq = chain[j];

			if ( support.hasChildrenTag && seq.$union === '>' && typeof( seq.$tag ) !== 'undefined' && order['>T'] > seq.$.$pri ) {
				tag = seq[ seq.$tag ];
				seq.$ = make( '>T', [tag[0]] );
				tag.$kind = '*';
			} else if ( order[ seq.$union ] > seq.$.$pri ) {
				seq.$ = make( seq.$union, [] );
			}

			if ( j === 0 && chain.$index === 0  ) {
				seed = seq.$;
			}
		}

		if ( seed.$pri === 0 && seed.$kind !== '*' ) {
			seed = make( 'T', ['*'] );
			chain[ chain.$index ].$ = seed;
			chain[ chain.$index ].push( seed );
		}

		//check root
		if ( chain[0].$union != ' ' ) {
			chain[0].$check = chain.$index !== 0;
		}

		return chain;
	}

	function build( chain ) {
		cid = 0;
		chain = compute( chain );

		var index = chain.$index,
			seed = chain[ index ],
			code = find( seed, true ),
			next = right( chain, template.push ),
			prev;
		
		if ( index > 0 ) {
			prev = left( chain );
			next = format( prev, {Y: next} );
		}

		code = format( code, {X: next} );

		return format( '${X}', {X: code} );
	}

	//find the seed of nodes
	function find( q, isSeed ) {
		var sc = q.$,
			code = template.find[ sc.$kind ],
			val = sc && ( sc.$kind === '.' ? sc.shift() : sc[0] );

		if ( !checker[ sc.$kind ] ) {
			q.push( make(':element', []) );
		}

		//do not test seed selector
		if ( sc.$kind !== '.' || sc.length === 0 ) {
			sc.$kind = '*';
		}

		return format(code, {
			P: val,
			N: q.N,
			R: isSeed ? 'root' : q.R,
			X: then( q )
		});
	}

	//filter descendants
	function right( chain, then ) {
		var i = chain.$index + 1,
			len = chain.length,
			code = '${X}',
			part = chain[ chain.length-1 ],
			next;

		for ( ; i < len; i++ ) {
			code = format( code, {X: find( chain[i] )} );
		}

		if ( !then ) {
			next = format( template.help, {N: part.N} );
			code = format( code, {X: next} );
		} else {
			next = format( then, {N: part.N} );
			code = format( code, {X: next} );
		}

		return code;
	}

	//filter ancestors
	function left( chain ) {
		var code = template.left,
			i = chain.$index - 1,
			q,
			last;

		for ( ; i > -1; i-- ) {
			q = chain[ i ];
			last = chain[ i+1 ];
			code = format( code, {X: pass(q, last.N, last.$union)} );
		}

		code = format( code, {X: template.pass.exit} );
		code = format( code, {R: chain[0].R} );

		return code;
	}

	function pass( q, term, union ){
		return format(template.pass[union], {
			N: q.N,
			C: term,
			X: then( q )
		});
	}

	function then( q ) {
		var code = filter( q );

		code = code ? 'if(' + code + '){${X}}' : '';

		if ( q.$first && q.$union != ' ' && q.$check ) {
			code = format( code, {X: template.radix[q.$union]} );
		}

		return code ? format(code, { N: q.N }) : '${X}';
	}

	function filter( q ) {
		var s = [],
			k = q.length,
			m,
			code;

		while ( k-- ) {
			m = q[k];

			if ( code = test( m ) ) {
				s.push( code );
			}
		}

		return s.join( ' && ' );
	}

	//check attributes
	function test( m ) {
		var t;

		if ( m.$kind.indexOf( '=' ) > -1 ) {
			m.A = attr( m[0] );
		}

		switch( m.$kind ) {
			case '.':
				var k = m.length,
					s = [];

				if ( k === 0 ) {
					return '';
				}

				while ( k-- ) {
					s.push( 't.indexOf(" ${'+ k +'} ")!==-1' );
				}

				t = '(t=${N}.className)&&((t=" "+t+" "),(' + s.join(' && ') + '))';

				return format( t, m );
			case ':not':
				t = filter( m[0][0][0] );
				return t ? '!(' + t + ')' : 'false';
			case ':not-ex':
			case ':has':
				m.G = cid++;
				break;
			case ':nth-child':
				m[0] = m[0] === 'even' ? '2n' : (m[0] === 'odd' ? '2n+1' : m[0]);
				t = rMatchPos.exec( m[0] );
				m[1] = (t[1] + (t[2] || 1)) - 0;
				m[2] = t[3] - 0;
				break;
			case '*':
				return '';
			default:
				break;
		}

		return format( template.test[m.$kind], m );
	}

	//special attributes
	function attr( name ) {
		switch ( name ) {
			case 'for':
				return '${N}.htmlFor';
			case 'class':
				return '${N}.className';
			case 'type':
				return '${N}.getAttribute("type")';
			case 'href':
				return '${N}.getAttribute("href",2)';
			default:
				return '(${N}["' + name + '"]||${N}.getAttribute("' + name + '"))';
		}
	}

	//templates
	template.doc = '/*^var doc=root.ownerDocument||root;^*/';
	template.xml = template.doc + '/*^var isXML=query.isXML(doc);^*/';

	template.main = 'function(root){var result=[];var xid=query.xid,t,l=result.length;BQ:{${X}}query.xid=xid;return result;}';
	template.xid = '${N}._x_id||(${N}._x_id=++xid)';
	template.push = 'result[l++]=${N};';
	template.left = 'var ${R}V={_:false};NP_${R}:{P_${R}:{${X}break NP_${R};}${R}V._=true;${Y}}';
	template.contains = support.hasDocPos ? '${0}.compareDocumentPosition(${1})&16' : '${0}.contains(${1})';
	template.help = '/*^var ${N}l;^*/if(!${N}l||!(' + format(template.contains, ['${N}l', '${N}']) +')){${X}${N}l=${N};}';

	template.pass = {
		main: 'if(t=${N}h[' + template.xid + ']){if(t._){break P_${R};}else{break NP_${R};}}${N}h[' + template.xid + ']=${R}V;${X}',
		exit: 'break P_${R};'
	};
	template.pass.up = format(template.pass.main, {X: 'if(${N}!==${R}){${X}}'});
	template.pass['>'] = '/*^var ${N}h={};^*/var ${N}=${C}.parentNode;' + template.pass.up;
	template.pass[' '] = '/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.parentNode){' + template.pass.up + '}';
	template.pass['+'] = support.hasByElement ? '/*^var ${N}h={};var ${N};^*/if(${N}=${C}.previousElementSibling){${X}}' : '/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousSibling){${X}break;}';
	template.pass['~'] = support.hasByElement ? '/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousElementSibling){' + template.pass.main + '}' : '/*^var ${N}h={};^*/var ${N}=${C};while(${N}=${N}.previousSibling){' + template.pass.main + '}';

	template.find = {
		'#': 'var ${N}=query.byId("${P}", ${R});if(${N}){${X}}',
		'N': template.doc + 'var ${N}a=doc.getElementsByName("${P}");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){if(${R}===doc||' + format(template.contains, ['${R}', '${N}']) +'){${X}}}',
		'T': 'var ${N}a=${R}.getElementsByTagName("${P}");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		'.': 'var ${N}a=${R}.getElementsByClassName("${P}");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		'*': 'var ${N}a=${R}.getElementsByTagName("*");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		'+': support.hasByElement ? '/*^var ${N};^*/if(${N}=${R}.nextElementSibling){${X}}' : 'var ${N}=${R};while(${N}=${N}.nextSibling){if(${N}.nodeType===1){${X}break;}}',
		'~': support.hasByElement ? '/*^var ${N}h={};^*/var ${N}=${R};while(${N}=${N}.nextElementSibling){if(${N}h[' + template.xid + '])break;${N}h[' + template.xid + ']=1;${X}}' : '/*^var ${N}h={};^*/var ${N}=${R};while(${N}=${N}.nextSibling){if(${N}.nodeType===1){if(${N}h[' + template.xid + '])break;${N}h[' + template.xid + ']=1;${X}}}',
		'>': 'var ${N}a=${R}.children||${R}.childNodes;for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}',
		'>T': 'var ${N}a=${R}.children.tags("${P}");for(var ${N}i=0,${N};${N}=${N}a[${N}i];${N}i++){${X}}'
	};

	template.radix = {
		'+': support.hasByElement ? 'if(${N}.previousElementSibling===root){${X}}' : 'var ${N}=${C};while(${N}=${N}.previousSibling){if(${N}.nodeType===1){break}}if(${N}===root){${X}}',
		'~': support.hasByElement ? 'if(root.compareDocumentPosition(${N})&4){${X}}' : 'if((root!=${N}&&root.contains(${N})&&16 )+(root!=${N}&&${N}.contains(root)&&8)+(root.nodeType===1?(root.sourceIndex<${N}.sourceIndex&&4)+(root.sourceIndex>${N}.sourceIndex&&2):1)&4){${X}}',
		'>': 'if(${N}.parentNode===root){${X}}'
	};

	template.tag = {
		'a': template.xml + '/*^var tag_a=isXML?"a":"A";^*/',
		'input': template.xml + '/*^var tag_input=isXML?"input":"INPUT";^*/'
	};

	template.test = {
		'T': template.xml +'/*^var ${N}t=isXML?"${0}":("${0}").toUpperCase();^*/${N}.nodeName===${N}t',
		'#': '${N}.id==="${0}"',
		'N': '${N}.name==="${0}"',
		'[': support.isIE678 ? '(t=${N}.getAttributeNode("${0}"))&&(t.specified)' : '${N}.hasAttribute("${0}")',
		'=': '${A}==="${1}"',
		'!=': '${A}!=="${1}"',
		'^=': '(t=${A})&&t.indexOf("${1}")===0',
		'$=': '(t=${A})&&t.indexOf("${1}")===(t.length - "${1}".length)',
		'*=': '(t=${A})&&t.indexOf("${1}")>-1',
		'|=': '(t=${A})&&t.indexOf("-${1}-")>-1',
		'~=': '(t=${A})&&(" "+t+" ").indexOf("${1}")!==-1',

		':root': '${N}===document.documentElement',
		':nth-child': template.doc + '/*^var rev=query.verocache;^*/query._index(${N},${1},${2},rev)',
		':nth-last-child': '',
		':nth-of-type': '',
		':nth-last-of-type': '',
		':first-child': support.hasByElement ? '!${N}.previousElementSibling' : 'query.isFirstChild(${N})',
		':last-child': support.hasByElement ? '!${N}.nextElementSibling' : 'query.isLastChild(${N})',
		':first-of-type': '',
		':last-of-type': '',
		':only-child': support.hasByElement ? '(t=${N}.parentNode)&&(t.firstElementChild===t.lastElementChild)' : 'query.isOnlyChild(${N})',
		':only-of-type': '',

		':empty': '!${N}.firstChild',
		':link': template.tag.a + '${N}.nodeName===tag_a',
		//尝试hack
		':visited': template.tag.a + '${N}.nodeName===tag_a' + 'false',
		//检查document.activeElement兼容性
		':active': template.doc + '${N}===query.activeElement',
		':hover': template.doc + '${N}===query.hoverElement',
		':focus': template.doc + '${N}===query.activeElement',
		':target': template.tag.a + '${N}.nodeName===tag_a&&/#[^"]*/.test('+ attr("href") +'||"")',
		':lang': '${N}.lang==="${0}"',
		':enabled': '${N}.disabled===false&&${N}.type!=="hidden"',
		':disabled': '${N}.disabled===true',
		':checked': '${N}.checked===true',
		//does not match a real document element, let's return false for such these selector
		'::first-line': 'false',
		'::first-letter': 'false',
		'::before': 'false',
		'::after': 'false'
		/*
		 * ':not': '' use not-ex instead.
		 */
	};

	var cacheCompiled = {};
	function query(expr, root){
		var doc = root.ownerDocument || root,
			contextXML = query.isXML(root || document);
        if (contextXML) {
            return queryXML(expr, root);
        }

        var fn  = cacheCompiled[expr] || (cacheCompiled[expr] = compile(expr, true));
        //console.log(fn);
        var	ret = fn(root);

        return ret;
	}
	
	function queryXML() {
		return [];
	}
	
	query.xid = 1;
	query.verocache = 0;

	query.isXML = function(elem) {
		//var de = (elem ? elem.ownerDocument || elem : 0).documentElement;
		//return de ? de.nodeName !== "HTML" : false;
		return document.documentElement.nodeName == 'html';
	};

	query.isOnlyChild = function (node){
        return query.isLastChild(node) && query.isFirstChild(node);
    };

    query.isFirstChild = function (node){
        while (node = node.previousSibling) {
            if (node.nodeType === 1) return false;
        }
        return true;
    };

    query.isLastChild = function (node){
        while (node = node.nextSibling) {
            if (node.nodeType === 1) return false;
        }
        return true;
    };

	query.byId = function (id, root){
		if (support.hasByTagID) {
            return root.getElementsByTagName('*')[id];
		}
        var doc = root.ownerDocument || root;
        var node = doc.getElementById(id);
        if (node && ((root === doc) || query.contains(root, node)) && (!support.isIE678 || (node.id === id || node.getAttributeNode('id').nodeValue === id))) {
            return node;
        }
        return null;
    };

	query.contains = support.hasDocPos ? function (a, b){
        return a !== b && a.contains(b);
    } : function (a, b) {
        return a !== b && a.compareDocumentPosition(b) & 16;
    };

	query.has = function (node, nodes){
		var i = 0, t;
        for (; t = nodes[i++];) {
            if (!query.contains(node, t)) return false;
        }
        return true;
    };

	query._hash = function (rs){
        var hash = rs._x_hash;
        if (hash == null) {
            hash = rs._x_hash = {};
            var k = rs.length;
            var xid = query.xid;
            while (k--) {
                var it = rs[k];
                hash[it._x_id||(it._x_id = ++xid)] = 1;
            }
            query.xid = xid;
        }
        return hash;
    };

	query._in = function (nodes, sets){
        var hash = query._hash(sets),
        	ret = [],
        	i = 0, node;
        for (; i < nodes.length; i++) {
            node = nodes[i];
            if (hash[node._x_id || (node._x_id = ++query.xid)]) {
                ret.push(node);
            }
        }
        return ret;
    };

	query._index = function (node, a, b, rev){
		var p = node.parentNode,
        	count = 1, t;

		if (p && p.verocache !== rev) {
	        if (support.hasByElement) {
		        for (t = p.firstElementChild; t; t = t.nextElementSibling) {
	        		t._x_index = count++;
		        }
	        } else {
	        	for (t = p.firstChild; t; t = t.nextSibling) {
	        		if (t.nodeType === 1) {
		        		t._x_index = count++;
		        	}
		        }
	        }
			p.verocache = rev;
        }

        return a ? (node._x_index - b) % a === 0 : node._x_index === b;
    };

	var pseudos = {':root': 1,':nth-child': 2,':nth-last-child': 2,':nth-of-type': 2,':nth-last-of-type': 2,':first-child': 1,':last-child': 1,':first-of-type': 1,':last-of-type': 1,':only-child': 1,':only-of-type': 1,':empty': 1,':link': 1,':visited': 1,':active': 1,':hover': 1,':focus': 1,':target': 1,':lang': 2,':enabled': 1,':disabled': 1,':checked': 1,'::first-line': 1,'::first-letter': 1,'::before': 1,'::after': 1,':not': 2},
		pseudos_ex = {},
		templates = {
			doc: template.doc,
			xml: template.xml,
			tag: template.tag
		};

	function require(name) {
		var names = name.split('.'), t, val = templates;
		while (t = names.shift()) {
			val = val[t];
		}
		return val || '';
	};

	function provide() {
		var args = arguments, items = {}, key, item, name, override, withArg;
		if (args.length === 0) return;
		if (args.length > 1) {
			if (typeof(args[0]) != 'string') return;
			items[args[0]] = {
				tpl: args[1],
				withArg: args[2] === undefined ? 0 : args[2],
				override: args[3] === undefined ? 1 : args[3]
			};
		} else {
			if (typeof(args[0]) != 'object') return;
			items = args[0];
		}

		for (key in items) {
			item = items[key];
			if (typeof(item) == 'string') {
				item = {tpl: item};
			}
			name = key.toLowerCase();
			override = !!('override' in item ? item.override : 1);
			withArg = !!('withArg' in item ? item.withArg : 0);
			if ((name in pseudos) || (pseudos_ex[name] || 0) > 2) {
				continue;
			}
			if (!(name in pseudos_ex)) {
				pseudos_ex[name] = 1;
				pseudos_ex[name] += (withArg ? 1 : 0);
				pseudos_ex[name] += (override ? 0 : 2);
			}
			template.test[name] = item.tpl;
		}
	};

	//necessary internal extension of pseudos
	provide({
		':not-ex': {
			tpl: '/*^var _${G}=query._hash(query("${1}",root));xid=query.xid;^*/!_${G}[' + template.xid + ']',
			withArg: 1,
			override: 0
		},
		':element': {
			tpl: '${N}.nodeType===1',
			override: 0
		},
		':has': {
			tpl: '(t=query("${1}", ${N}),xid=query.xid,t.length>0)',
			withArg: 1,
			override: 0
		}
	});

	//extension
	provide({
		':contains': {
			tpl: (support.hasTextContent ? '${N}.textContent' : '${N}.innerText') + '.indexOf("${0}")!==-1',
			withArg: 1
		},
		':button': template.tag.input + '${N}.nodeName==="button"||(${N}.nodeName===tag_input&&${N}.type==="button")',
		':checkbox': template.tag.input + '${N}.nodeName===tag_input&&${N}.type==="checkbox"',
		':file': template.tag.input + '${N}.nodeName===tag_input&&${N}.type==="file"',
		':header': '/h\\d/i.test(${N}.nodeName)',
		':input': '/input|select|textarea|button/i.test(${N}.nodeName)',
		':submit': template.tag.input + '${N}.nodeName===tag_input&&${N}.type==="submit"',
		':reset': template.tag.input + '${N}.nodeName===tag_input&&${N}.type==="reset"',
		':selected': '(${N}.parentNode.selectedIndex,${N}.selected===true)',
		':image': template.tag.input + '${N}.nodeName===tag_input&&${N}.type==="image"',
		':parent': '!!${N}.firstChild'
	});

	function api(expr, root, result, seed){
        root = root || document;
        //recaculate nth-child
        query.verocache = query.verocache + 1;
        var ret = query(expr, root);
        if (seed) {
            ret = query._in(seed, ret);
        }
        if (result) {
            ret.push.apply(result, ret);
        } else {
            result = ret;
        }
        return result;
    }

	api.name = name;
	api.version = version;
	api.support = support;
	api.require = function() {
		return require.apply(null, arguments);
	};
	api.provide = function() {
		return provide.apply(null, arguments);
	};
	api.matches = function (expr, set){
        return query(expr, null, null, set);
    };

	return api;
})(window);
